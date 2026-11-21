import {
  addVec3,
  computeTangentFrame,
  distanceVec3,
  dotVec3,
  lengthVec3,
  normalizeVec3,
  PlanetWorld,
  scaleVec3,
  subVec3,
} from './planet';
import { SeededRandom } from './prng';
import { TuningConfig } from './tuning';
import {
  ImpactOutcome,
  ShotInput,
  SimulationResult,
  TankState,
  TrajectoryPoint,
  TurnOwner,
  Vec3,
  WindVector,
} from './types';

const MUZZLE_HEIGHT_OFFSET = 0.85;
const MUZZLE_BARREL_LENGTH = 1.35;
const TANK_COLLISION_RADIUS = 1.25;

/**
 * Calculates the 3D world muzzle position and unit firing direction vector for a tank.
 */
export function computeMuzzleTransform(
  tank: TankState,
  bearingDeg: number,
  elevationDeg: number,
): { muzzlePosition: Vec3; fireDirection: Vec3 } {
  const bearingRad = (bearingDeg * Math.PI) / 180;
  const elevationRad = (elevationDeg * Math.PI) / 180;

  const horizontalDir = normalizeVec3(
    addVec3(
      scaleVec3(tank.frame.north, Math.cos(bearingRad)),
      scaleVec3(tank.frame.east, Math.sin(bearingRad)),
    ),
  );

  const fireDirection = normalizeVec3(
    addVec3(
      scaleVec3(horizontalDir, Math.cos(elevationRad)),
      scaleVec3(tank.frame.normal, Math.sin(elevationRad)),
    ),
  );

  const turretBase = addVec3(
    tank.position,
    scaleVec3(tank.frame.normal, MUZZLE_HEIGHT_OFFSET),
  );
  const muzzlePosition = addVec3(
    turretBase,
    scaleVec3(fireDirection, MUZZLE_BARREL_LENGTH),
  );

  return { muzzlePosition, fireDirection };
}

/**
 * Computes tangential wind acceleration vector at any 3D point around the spherical planet.
 */
export function computeWindAccelerationAtPoint(position: Vec3, wind: WindVector): Vec3 {
  if (wind.strength <= 0.001) {
    return { x: 0, y: 0, z: 0 };
  }
  const unitNormal = normalizeVec3(position);
  const frame = computeTangentFrame(unitNormal);
  const rad = (wind.directionDeg * Math.PI) / 180;
  const tangentDir = normalizeVec3(
    addVec3(
      scaleVec3(frame.north, Math.cos(rad)),
      scaleVec3(frame.east, Math.sin(rad)),
    ),
  );
  // Scale slightly so wind acceleration feels tangible over 2–5 second flights
  return scaleVec3(tangentDir, wind.strength * 0.85);
}

/**
 * Shared deterministic ballistic simulation used by:
 * 1) The live projectile flight
 * 2) The translucent 25% trajectory guide (with varianceSeed = null)
 * 3) The 3-tier AI solver (User Story 53)
 */
export function simulateShot(
  planet: PlanetWorld,
  shooter: TankState,
  allTanks: Record<TurnOwner, TankState>,
  wind: WindVector,
  tuning: TuningConfig,
  input: ShotInput,
): SimulationResult {
  let appliedBearingDeg = input.bearingDeg;
  let appliedElevationDeg = input.elevationDeg;
  let appliedPower = Math.max(10, Math.min(100, input.power));

  // Apply small inherent shot variance when varianceSeed is provided (User Story 22 & 38)
  if (input.varianceSeed && tuning.shotVariancePct > 0) {
    const rng = new SeededRandom(input.varianceSeed);
    const vScale = tuning.shotVariancePct / 100;
    appliedBearingDeg += rng.gaussian(0, 1.35 * vScale * 20);
    appliedElevationDeg = Math.max(
      3,
      Math.min(87, appliedElevationDeg + rng.gaussian(0, 0.85 * vScale * 20)),
    );
    appliedPower = Math.max(
      8,
      Math.min(100, appliedPower * (1 + rng.gaussian(0, 0.45 * vScale))),
    );
  }

  const { muzzlePosition, fireDirection } = computeMuzzleTransform(
    shooter,
    appliedBearingDeg,
    appliedElevationDeg,
  );

  const powerFraction = (appliedPower - 10) / 90;
  const muzzleSpeed =
    tuning.minMuzzleSpeed +
    powerFraction * (tuning.maxMuzzleSpeed - tuning.minMuzzleSpeed);

  let pos = { ...muzzlePosition };
  let vel = scaleVec3(fireDirection, muzzleSpeed);

  const gravityMagnitude = tuning.gravityScale * planet.preset.gravityMultiplier;
  const dt = 0.025;
  const maxSteps = 720; // Up to 18 seconds simulated flight

  const points: TrajectoryPoint[] = [
    {
      position: { ...pos },
      velocity: { ...vel },
      time: 0,
      altitude: lengthVec3(pos) - planet.baseRadius,
    },
  ];

  let hitWater = false;
  let impactPosition = { ...pos };
  let impactNormal = normalizeVec3(pos);
  let elapsed = 0;

  const opponentId: TurnOwner = shooter.id === 'player' ? 'ai' : 'player';
  const opponentTank = allTanks[opponentId];
  const opponentCenter = addVec3(
    opponentTank.position,
    scaleVec3(opponentTank.normal, 0.6),
  );

  for (let step = 1; step <= maxSteps; step++) {
    const prevPos = { ...pos };
    elapsed = step * dt;

    // Velocity-Verlet / RK2 midpoint integration under planet-centred gravity + wind
    const radialDir1 = normalizeVec3(pos);
    const gravAcc1 = scaleVec3(radialDir1, -gravityMagnitude);
    const windAcc1 = computeWindAccelerationAtPoint(pos, wind);
    const acc1 = addVec3(gravAcc1, windAcc1);

    const midPos = addVec3(
      pos,
      scaleVec3(addVec3(vel, scaleVec3(acc1, 0.5 * dt)), 0.5 * dt),
    );
    const radialDirMid = normalizeVec3(midPos);
    const gravAccMid = scaleVec3(radialDirMid, -gravityMagnitude);
    const windAccMid = computeWindAccelerationAtPoint(midPos, wind);
    const accMid = addVec3(gravAccMid, windAccMid);

    vel = addVec3(vel, scaleVec3(accMid, dt));
    pos = addVec3(pos, scaleVec3(vel, dt));

    const currentRadius = lengthVec3(pos);
    const unitDir = normalizeVec3(pos);

    // Check direct collision with opponent tank hull
    const distToOpponent = distanceVec3(pos, opponentCenter);
    if (distToOpponent <= TANK_COLLISION_RADIUS) {
      impactPosition = { ...pos };
      impactNormal = unitDir;
      hitWater = false;
      points.push({
        position: { ...impactPosition },
        velocity: { ...vel },
        time: elapsed,
        altitude: currentRadius - planet.baseRadius,
      });
      break;
    }

    // Check self-collision after clearing the barrel
    if (step > 8) {
      const shooterCenter = addVec3(shooter.position, scaleVec3(shooter.normal, 0.6));
      if (distanceVec3(pos, shooterCenter) <= TANK_COLLISION_RADIUS * 0.9) {
        impactPosition = { ...pos };
        impactNormal = unitDir;
        hitWater = false;
        points.push({
          position: { ...impactPosition },
          velocity: { ...vel },
          time: elapsed,
          altitude: currentRadius - planet.baseRadius,
        });
        break;
      }
    }

    // Check terrain / water surface intersection
    const surface = planet.sampleSurfaceRadius(unitDir);
    if (currentRadius <= surface.radius) {
      // Binary-refine the exact surface intersection between prevPos and pos
      let lo = { ...prevPos };
      let hi = { ...pos };
      for (let iter = 0; iter < 6; iter++) {
        const mid = scaleVec3(addVec3(lo, hi), 0.5);
        const midDir = normalizeVec3(mid);
        const midSurf = planet.sampleSurfaceRadius(midDir);
        if (lengthVec3(mid) <= midSurf.radius) {
          hi = mid;
        } else {
          lo = mid;
        }
      }
      const refinedDir = normalizeVec3(hi);
      const refinedSurf = planet.sampleSurfaceRadius(refinedDir);
      impactPosition = scaleVec3(refinedDir, refinedSurf.radius);
      impactNormal = refinedDir;
      hitWater = refinedSurf.isWater;

      points.push({
        position: { ...impactPosition },
        velocity: { ...vel },
        time: elapsed,
        altitude: refinedSurf.radius - planet.baseRadius,
      });
      break;
    }

    points.push({
      position: { ...pos },
      velocity: { ...vel },
      time: elapsed,
      altitude: currentRadius - planet.baseRadius,
    });

    // If projectile escapes into high orbit, cap trajectory gracefully
    if (currentRadius > planet.baseRadius + tuning.terrainAmplitude * 8 + 45) {
      impactPosition = { ...pos };
      impactNormal = unitDir;
      break;
    }
  }

  // Extract only the first ~25% of the arc for the trajectory guide (User Story 18: never show landing point)
  const clampedFraction = Math.max(0.08, Math.min(0.4, tuning.guideArcFraction));
  const previewCount = Math.max(
    3,
    Math.min(points.length - 2, Math.floor(points.length * clampedFraction)),
  );
  const previewPoints = points.slice(0, previewCount).map((p) => p.position);

  return {
    points,
    previewPoints,
    impactPosition,
    impactNormal,
    hitWater,
    flightDuration: elapsed,
    appliedBearingDeg,
    appliedElevationDeg,
    appliedPower,
  };
}

/**
 * Calculates blast damage falloff with distance from impact point (User Stories 24, 25, 30).
 * Maximum damage at the centre, falling off smoothly to zero beyond blastRadius.
 * Water splashes still deal blast damage to shoreline tanks within blastRadius!
 */
export function computeBlastDamage(
  impactPosition: Vec3,
  tank: TankState,
  tuning: TuningConfig,
): number {
  const tankHullCenter = addVec3(tank.position, scaleVec3(tank.normal, 0.55));
  const dist = distanceVec3(impactPosition, tankHullCenter);
  const effectiveDist = Math.max(0, dist - 0.65);

  if (effectiveDist >= tuning.blastRadius) {
    return 0;
  }

  const normalized = 1.0 - effectiveDist / tuning.blastRadius;
  // Smooth curve that rewards direct/near hits with ~200 damage (2-hit kill on 400 HP)
  const falloff = Math.pow(normalized, 1.25);
  return Math.max(1, Math.round(tuning.maxBlastDamage * falloff));
}

/**
 * Applies a shot's impact to the planet (carving a persistent crater unless hitting water or under a tank)
 * and computes health damage to both tanks.
 */
export function resolveShotImpact(
  planet: PlanetWorld,
  simResult: SimulationResult,
  tanks: Record<TurnOwner, TankState>,
  tuning: TuningConfig,
  turn: number,
): ImpactOutcome {
  const craterCreated = simResult.hitWater
    ? null
    : planet.carveCrater(
        simResult.impactPosition,
        tuning.craterRadius,
        tuning.craterDepth,
        turn,
      );

  const playerDamage = computeBlastDamage(
    simResult.impactPosition,
    tanks.player,
    tuning,
  );
  const aiDamage = computeBlastDamage(simResult.impactPosition, tanks.ai, tuning);

  tanks.player.health = Math.max(0, tanks.player.health - playerDamage);
  tanks.ai.health = Math.max(0, tanks.ai.health - aiDamage);

  // Ensure tanks remain grounded on their protected footprint height
  for (const owner of ['player', 'ai'] as const) {
    const t = tanks[owner];
    const r = planet.sampleTerrainRadius(t.normal);
    t.position = scaleVec3(t.normal, r);
  }

  const directHit =
    playerDamage >= tuning.maxBlastDamage * 0.78 ||
    aiDamage >= tuning.maxBlastDamage * 0.78;

  let killedTank: TurnOwner | null = null;
  if (tanks.ai.health <= 0) {
    killedTank = 'ai';
  } else if (tanks.player.health <= 0) {
    killedTank = 'player';
  }

  return {
    hitPoint: simResult.impactPosition,
    hitNormal: simResult.impactNormal,
    hitWater: simResult.hitWater,
    craterCreated,
    damages: {
      player: playerDamage,
      ai: aiDamage,
    },
    directHit,
    killedTank,
  };
}

/**
 * Helper to compute signed angular overshoot (radians) and lateral bearing error (degrees)
 * between an impact point and a target tank.
 */
export function evaluateShotError(
  shooter: TankState,
  target: TankState,
  impactPoint: Vec3,
): { distanceError: number; overshotRad: number; bearingErrorDeg: number } {
  const distanceError = distanceVec3(impactPoint, target.position);
  const shooterN = shooter.normal;
  const targetN = target.normal;
  const impactN = normalizeVec3(impactPoint);

  const shooterToTargetRad = Math.acos(
    Math.max(-1, Math.min(1, dotVec3(shooterN, targetN))),
  );
  const shooterToImpactRad = Math.acos(
    Math.max(-1, Math.min(1, dotVec3(shooterN, impactN))),
  );
  const overshotRad = shooterToImpactRad - shooterToTargetRad;

  const toTarget = subVec3(target.position, shooter.position);
  const toImpact = subVec3(impactPoint, shooter.position);
  const targetBearing =
    (Math.atan2(
      dotVec3(toTarget, shooter.frame.east),
      dotVec3(toTarget, shooter.frame.north),
    ) *
      180) /
    Math.PI;
  const impactBearing =
    (Math.atan2(
      dotVec3(toImpact, shooter.frame.east),
      dotVec3(toImpact, shooter.frame.north),
    ) *
      180) /
    Math.PI;

  let bearingErrorDeg = ((impactBearing - targetBearing + 540) % 360) - 180;
  if (Number.isNaN(bearingErrorDeg)) {
    bearingErrorDeg = 0;
  }

  return { distanceError, overshotRad, bearingErrorDeg };
}
