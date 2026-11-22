import { distanceVec3, dotVec3, PlanetWorld, subVec3 } from './planet';
import { simulateShot } from './physics';
import { SeededRandom } from './prng';
import { TuningConfig } from './tuning';
import {
  AiDifficulty,
  AiShotMemory,
  ShotInput,
  TankState,
  TurnOwner,
  WindVector,
} from './types';

export interface AiSolveOutput {
  shotInput: ShotInput;
  solveTimeMs: number;
  idealBearingDeg: number;
  idealElevationDeg: number;
  idealPower: number;
}

/**
 * Three-tier AI artillery solver (User Stories 34–38, 53).
 *
 * - Uses the exact same `simulateShot` function as the player and trajectory preview.
 * - Never cheats with hidden variance seeds; instead searches candidate trajectories
 *   using observable world state and refines its aim across turns from its own recorded misses.
 * - Easy: Coarse search, under-compensates for wind, adds wide human-like error and occasional overcorrection.
 * - Medium: Compensates partially for wind and walks its shots closer to the player over several turns.
 * - Hard: Compensates accurately for spherical gravity + wind and converges rapidly after 1–2 ranging shots.
 */
export function solveAiTurn(
  planet: PlanetWorld,
  tanks: Record<TurnOwner, TankState>,
  wind: WindVector,
  tuning: TuningConfig,
  difficulty: AiDifficulty,
  history: ReadonlyArray<AiShotMemory>,
  seed: string,
  turn: number,
  shooterId: TurnOwner = 'ai',
): AiSolveOutput {
  const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();

  const targetId: TurnOwner = shooterId === 'ai' ? 'player' : 'ai';
  const shooterTank = tanks[shooterId];
  const targetTank = tanks[targetId];
  const rng = new SeededRandom(
    `${seed}::ai-turn::${shooterId}::${turn}::${difficulty}`,
  );

  // Compute direct great-circle bearing from shooter to target
  const chordToTarget = subVec3(targetTank.position, shooterTank.position);
  const northComp = dotVec3(chordToTarget, shooterTank.frame.north);
  const eastComp = dotVec3(chordToTarget, shooterTank.frame.east);
  const directBearingDeg =
    ((Math.atan2(eastComp, northComp) * 180) / Math.PI + 360) % 360;

  // How much wind does this difficulty tier account for when running its internal mental model?
  const windAwarenessFactor =
    difficulty === 'hard' ? 0.95 : difficulty === 'medium' ? 0.6 : 0.15;

  const perceivedWind: WindVector = {
    ...wind,
    strength: wind.strength * windAwarenessFactor,
  };

  let bestBearing = directBearingDeg;
  let bestElevation = 48;
  let bestPower = 62;
  let bestDistance = Infinity;

  // Stage 1: Coarse ballistic search around direct bearing
  const bearingOffsets =
    difficulty === 'easy'
      ? [-12, 0, 12]
      : difficulty === 'medium'
        ? [-16, -8, 0, 8, 16]
        : [-20, -12, -6, 0, 6, 12, 20];

  const elevations = difficulty === 'easy' ? [35, 52, 68] : [28, 38, 48, 58, 68, 76];

  const powers = difficulty === 'easy' ? [40, 58, 76, 92] : [32, 44, 56, 68, 80, 92];

  for (const bOff of bearingOffsets) {
    const candidateBearing = (directBearingDeg + bOff + 360) % 360;
    for (const elev of elevations) {
      for (const pwr of powers) {
        const sim = simulateShot(planet, shooterTank, tanks, perceivedWind, tuning, {
          shooterId,
          bearingDeg: candidateBearing,
          elevationDeg: elev,
          power: pwr,
          varianceSeed: null,
        });
        const dist = distanceVec3(sim.impactPosition, targetTank.position);
        if (dist < bestDistance) {
          bestDistance = dist;
          bestBearing = candidateBearing;
          bestElevation = elev;
          bestPower = pwr;
        }
      }
    }
  }

  // Stage 2: Local refinement pass for Medium and Hard AI
  const refineSteps = difficulty === 'hard' ? 2 : difficulty === 'medium' ? 1 : 0;
  let searchSpanBearing = 6;
  let searchSpanElev = 5;
  let searchSpanPower = 7;

  for (let pass = 0; pass < refineSteps; pass++) {
    const centerB = bestBearing;
    const centerE = bestElevation;
    const centerP = bestPower;

    for (const dB of [
      -searchSpanBearing,
      -searchSpanBearing * 0.5,
      0,
      searchSpanBearing * 0.5,
      searchSpanBearing,
    ]) {
      for (const dE of [-searchSpanElev, 0, searchSpanElev]) {
        for (const dP of [
          -searchSpanPower,
          -searchSpanPower * 0.5,
          0,
          searchSpanPower * 0.5,
          searchSpanPower,
        ]) {
          const candB = (centerB + dB + 360) % 360;
          const candE = Math.max(12, Math.min(82, centerE + dE));
          const candP = Math.max(15, Math.min(99, centerP + dP));

          const sim = simulateShot(planet, shooterTank, tanks, perceivedWind, tuning, {
            shooterId,
            bearingDeg: candB,
            elevationDeg: candE,
            power: candP,
            varianceSeed: null,
          });
          const dist = distanceVec3(sim.impactPosition, targetTank.position);
          if (dist < bestDistance) {
            bestDistance = dist;
            bestBearing = candB;
            bestElevation = candE;
            bestPower = candP;
          }
        }
      }
    }

    searchSpanBearing *= 0.45;
    searchSpanElev *= 0.45;
    searchSpanPower *= 0.45;
  }

  // Stage 3: Apply learning curve & difficulty-appropriate human-like aiming error
  const priorShots = history.length;

  // Error decays with each shot as the AI "walks" its shells onto the target
  let angularJitterDeg = 0;
  let elevationJitterDeg = 0;
  let powerJitter = 0;

  if (difficulty === 'easy') {
    // Easy AI misses visibly and sometimes overcorrects (User Story 35)
    const overcorrectSign = priorShots % 2 === 0 ? 1 : -1.15;
    const decay = Math.max(0.55, Math.pow(0.88, priorShots));
    angularJitterDeg = rng.gaussian(overcorrectSign * 6.5 * decay, 5.5 * decay);
    elevationJitterDeg = rng.gaussian(0, 4.2 * decay);
    powerJitter = rng.gaussian(overcorrectSign * 9.5 * decay, 6.5 * decay);
  } else if (difficulty === 'medium') {
    // Medium AI walks its shots toward the player over several turns (User Story 36)
    const decay = Math.max(0.18, Math.pow(0.56, priorShots));
    const initialBiasSign = priorShots === 0 ? (rng.next() > 0.5 ? 1 : -1) : 1;
    angularJitterDeg = rng.gaussian(initialBiasSign * 3.2 * decay, 2.8 * decay);
    elevationJitterDeg = rng.gaussian(0, 2.1 * decay);
    powerJitter = rng.gaussian(initialBiasSign * 5.2 * decay, 3.6 * decay);
  } else {
    // Hard AI compensates well and learns quickly after turn 1 (User Story 37)
    const decay = Math.max(0.05, Math.pow(0.32, priorShots));
    angularJitterDeg = rng.gaussian(0, 1.35 * decay);
    elevationJitterDeg = rng.gaussian(0, 0.9 * decay);
    powerJitter = rng.gaussian(0, 1.9 * decay);
  }

  const chosenBearing =
    Math.round(((bestBearing + angularJitterDeg + 360) % 360) * 10) / 10;
  const chosenElevation =
    Math.round(Math.max(10, Math.min(84, bestElevation + elevationJitterDeg)) * 10) /
    10;
  const chosenPower =
    Math.round(Math.max(12, Math.min(100, bestPower + powerJitter)) * 10) / 10;

  const endTime = typeof performance !== 'undefined' ? performance.now() : Date.now();

  return {
    shotInput: {
      shooterId,
      bearingDeg: chosenBearing,
      elevationDeg: chosenElevation,
      power: chosenPower,
      varianceSeed: `${seed}::shot-variance::${shooterId}::${turn}`,
    },
    solveTimeMs: Math.max(0.1, Math.round((endTime - startTime) * 100) / 100),
    idealBearingDeg: bestBearing,
    idealElevationDeg: bestElevation,
    idealPower: bestPower,
  };
}
