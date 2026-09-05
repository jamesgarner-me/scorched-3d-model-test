import { simulateShot, powerToSpeed, type SimWorld, type ShotPath } from './physics';
import type { Rng } from './rng';
import { muzzlePoint } from './tank';
import {
  angleBetween,
  bearingTo,
  clamp,
  dist,
  dot,
  norm,
  scale as vscale,
  sub,
  surfaceFrame,
  aimDirection,
  type Frame,
  type Vec3,
} from './vec';

export type Difficulty = 'easy' | 'medium' | 'hard';

export const DIFFICULTIES: { id: Difficulty; name: string; blurb: string }[] = [
  { id: 'easy', name: 'Recruit', blurb: 'Misses visibly and sometimes overcorrects.' },
  { id: 'medium', name: 'Gunner', blurb: 'Walks its shots onto you over a few turns.' },
  { id: 'hard', name: 'Marshal', blurb: 'Reads wind and gravity fast. Never cheats.' },
];

interface DifficultyProfile {
  bearing: number;
  elevation: number;
  power: number;
  /** How much of the standing aim error survives each shot. Lower = learns faster. */
  learn: number;
  overcorrectChance: number;
}

const PROFILES: Record<Difficulty, DifficultyProfile> = {
  easy: { bearing: 8.5, elevation: 6.5, power: 15, learn: 0.92, overcorrectChance: 0.35 },
  medium: { bearing: 4.2, elevation: 3.2, power: 7.5, learn: 0.62, overcorrectChance: 0.1 },
  hard: { bearing: 0.7, elevation: 0.6, power: 1.4, learn: 0.22, overcorrectChance: 0 },
};

export interface Aim {
  bearing: number;
  elevation: number;
  power: number;
}

/**
 * The AI's standing aim error. It is seeded once per match and shrinks after every
 * shot, which is what makes shots visibly walk in rather than teleport onto target.
 */
export interface AiMemory {
  difficulty: Difficulty;
  bias: Aim;
  errorScale: number;
  shots: number;
  lastMiss: number | null;
  lastSolveMillis: number;
}

export function createAiMemory(difficulty: Difficulty, rng: Rng): AiMemory {
  const p = PROFILES[difficulty];
  return {
    difficulty,
    bias: {
      bearing: rng.jitter(1) * p.bearing,
      elevation: rng.jitter(1) * p.elevation,
      power: rng.jitter(1) * p.power,
    },
    errorScale: 1,
    shots: 0,
    lastMiss: null,
    lastSolveMillis: 0,
  };
}

/** Fold the outcome of a shot back into the standing error. */
export function learnFromShot(memory: AiMemory, missDistance: number, rng: Rng): void {
  const p = PROFILES[memory.difficulty];
  memory.shots += 1;
  memory.lastMiss = missDistance;
  memory.errorScale *= p.learn;
  if (rng() < p.overcorrectChance) {
    // Overshoot the correction and swing past the target — the classic novice mistake.
    memory.bias.bearing *= -1.4;
    memory.bias.elevation *= -1.3;
    memory.errorScale = Math.min(memory.errorScale * 1.7, 1.3);
  }
}

export interface Solution extends Aim {
  missDistance: number;
  path: ShotPath;
}

interface Shooter {
  position: Vec3;
  frame: Frame;
}

function fireFrom(shooter: Shooter, world: SimWorld, aim: Aim): ShotPath {
  const origin = muzzlePoint(shooter.position, shooter.frame, aim.bearing, aim.elevation);
  const velocity = vscale(
    aimDirection(shooter.frame, aim.bearing, aim.elevation),
    powerToSpeed(aim.power, world.muzzleScale),
  );
  return simulateShot(origin, velocity, world, { collectPath: false });
}

/** Signed angular range of a shot along the aiming direction, in radians. */
function signedRange(shooter: Shooter, path: ShotPath, tangent: Vec3): number {
  if (!path.impact) return Math.PI; // Escaped or timed out: treat as a wild overshoot.
  const from = norm(shooter.position);
  const to = norm(path.impact.position);
  const angle = angleBetween(from, to);
  const lateral = sub(to, vscale(from, dot(to, from)));
  return dot(lateral, tangent) >= 0 ? angle : -angle;
}

/** Find the power whose range best matches the target, assuming range grows with power. */
function bisectPower(
  shooter: Shooter,
  world: SimWorld,
  bearing: number,
  elevation: number,
  targetAngle: number,
  tangent: Vec3,
): { power: number; path: ShotPath } {
  let lo = 0;
  let hi = 100;
  let best = { power: 50, path: fireFrom(shooter, world, { bearing, elevation, power: 50 }) };
  for (let i = 0; i < 12; i++) {
    const mid = (lo + hi) / 2;
    const path = fireFrom(shooter, world, { bearing, elevation, power: mid });
    best = { power: mid, path };
    if (signedRange(shooter, path, tangent) < targetAngle) lo = mid;
    else hi = mid;
  }
  return best;
}

/**
 * Search bearing / elevation / power for the shot that lands closest to `target`.
 *
 * `shooterPosition` is the tank's *ground contact point*, not its muzzle — the barrel
 * offset is added internally, exactly as it is when the shot is really fired.
 *
 * Uses only information a player can see — both tanks' positions, the terrain, the
 * wind on the HUD — and the same simulation the player's guide draws from. It does
 * not know the variance roll that will be applied to its own shot.
 */
export function solveAim(world: SimWorld, shooterPosition: Vec3, target: Vec3): Solution {
  const frame = surfaceFrame(shooterPosition);
  const shooter: Shooter = { position: shooterPosition, frame };
  const baseBearing = bearingTo(frame, shooterPosition, target);
  const targetAngle = angleBetween(shooterPosition, target);

  const tangentFor = (bearing: number): Vec3 => {
    const dir = aimDirection(frame, bearing, 0);
    return norm(sub(dir, vscale(frame.up, dot(dir, frame.up))));
  };

  const evaluate = (bearing: number, elevation: number): Solution => {
    const { power, path } = bisectPower(shooter, world, bearing, elevation, targetAngle, tangentFor(bearing));
    const missDistance = path.impact ? dist(path.impact.position, target) : Number.POSITIVE_INFINITY;
    return { bearing, elevation, power, missDistance, path };
  };

  let best = evaluate(baseBearing, 45);

  // 1. Which launch angle suits this range and this terrain?
  for (const elevation of [22, 30, 38, 52, 60, 68]) {
    const candidate = evaluate(baseBearing, elevation);
    if (candidate.missDistance < best.missDistance) best = candidate;
  }

  // 2. How far upwind must it aim to let the wind carry the shell back?
  for (let i = -4; i <= 4; i++) {
    if (i === 0) continue;
    const candidate = evaluate(baseBearing + i * 4, best.elevation);
    if (candidate.missDistance < best.missDistance) best = candidate;
  }

  // 3. Tighten both axes around the winner.
  for (let i = -2; i <= 2; i++) {
    if (i === 0) continue;
    const byBearing = evaluate(best.bearing + i * 1.2, best.elevation);
    if (byBearing.missDistance < best.missDistance) best = byBearing;
    const byElevation = evaluate(best.bearing, clamp(best.elevation + i * 2.5, 5, 85));
    if (byElevation.missDistance < best.missDistance) best = byElevation;
  }

  return best;
}

export interface AiDecision {
  aim: Aim;
  /** What a perfect shot would have been — used to measure how far off it chose to be. */
  ideal: Aim;
  predictedMiss: number;
  solveMillis: number;
}

/** Decide this turn's shot: solve properly, then miss by the amount the difficulty allows. */
export function decideShot(
  world: SimWorld,
  shooterPosition: Vec3,
  target: Vec3,
  memory: AiMemory,
): AiDecision {
  const started = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const solution = solveAim(world, shooterPosition, target);
  const scale = memory.errorScale;
  const aim: Aim = {
    bearing: solution.bearing + memory.bias.bearing * scale,
    elevation: clamp(solution.elevation + memory.bias.elevation * scale, 3, 86),
    power: clamp(solution.power + memory.bias.power * scale, 1, 100),
  };
  const solveMillis = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - started;
  memory.lastSolveMillis = solveMillis;
  return {
    aim,
    ideal: { bearing: solution.bearing, elevation: solution.elevation, power: solution.power },
    predictedMiss: solution.missDistance,
    solveMillis,
  };
}

/** True when a shot from `from` can plausibly reach `to` — used to validate tank placement. */
export function isReachable(world: SimWorld, from: Vec3, to: Vec3, tolerance: number): boolean {
  return solveAim(world, from, to).missDistance <= tolerance;
}
