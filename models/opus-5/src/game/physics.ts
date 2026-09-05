import type { Rng } from './rng';
import { tuning } from './tuning';
import {
  aimDirection,
  clamp,
  cross,
  dist,
  len,
  mulAdd,
  norm,
  rotateAbout,
  scale,
  type Frame,
  type Vec3,
} from './vec';

export type TankId = 'player' | 'ai';

export interface SimTank {
  id: TankId;
  position: Vec3;
  hitRadius: number;
}

/** Everything the integrator needs. Deliberately free of Three.js and of React. */
export interface SimWorld {
  radius: number;
  seaLevel: number;
  hasOcean: boolean;
  /** Surface gravity magnitude; falls off with the inverse square of distance. */
  gravity: number;
  /** Preset multiplier on muzzle speed. */
  muzzleScale: number;
  /** Constant wind acceleration, world space. */
  wind: Vec3;
  heightAt(direction: Vec3): number;
  tanks: SimTank[];
}

export type ImpactKind = 'terrain' | 'water' | 'tank';

export interface Impact {
  kind: ImpactKind;
  position: Vec3;
  /** Unit direction from the planet centre to the impact. */
  dir: Vec3;
  tankId?: TankId;
}

export interface ShotPath {
  points: Vec3[];
  impact: Impact | null;
  /** True when the shell left the play volume without landing. */
  escaped: boolean;
  flightTime: number;
  apoapsis: number;
}

export interface SimOptions {
  /** Skip storing the path when only the impact matters (the AI's search). */
  collectPath?: boolean;
}

/** Power (0–100) → muzzle speed. Power 0 still fires, just weakly. */
export function powerToSpeed(power: number, muzzleScale = 1): number {
  const p = clamp(power, 0, 100) / 100;
  return tuning.muzzleSpeed * muzzleScale * (tuning.minPowerFraction + (1 - tuning.minPowerFraction) * p);
}

/**
 * Apply the inherent shot variance: a small angular wobble plus a small speed error.
 * Both the player and the AI go through this, so neither is robotically perfect.
 */
export function applyVariance(direction: Vec3, speed: number, rng: Rng): { direction: Vec3; speed: number } {
  const variance = tuning.shotVariance;
  if (variance <= 0) return { direction, speed };
  const maxAngle = variance * 0.14; // radians at full variance ≈ 0.4°
  const axis = norm(cross(direction, { x: rng.jitter(1), y: rng.jitter(1), z: rng.jitter(1) + 0.01 }));
  const wobbled = rotateAbout(direction, axis, rng.jitter(maxAngle));
  return { direction: wobbled, speed: speed * (1 + rng.jitter(variance)) };
}

/** Convenience: turn an aim solution into an initial velocity vector. */
export function aimVelocity(
  frame: Frame,
  bearing: number,
  elevation: number,
  power: number,
  muzzleScale = 1,
): Vec3 {
  return scale(aimDirection(frame, bearing, elevation), powerToSpeed(power, muzzleScale));
}

/** Radius of solid ground at a direction — terrain, or the waterline where terrain is submerged. */
function groundRadius(world: SimWorld, dir: Vec3): number {
  const h = world.heightAt(dir);
  return world.hasOcean ? Math.max(h, world.seaLevel) : h;
}

function acceleration(world: SimWorld, position: Vec3): Vec3 {
  const r = len(position);
  const inv = 1 / Math.max(r, 1e-4);
  // Inverse-square gravity, always towards the planet centre.
  const g = world.gravity * (world.radius * world.radius) / Math.max(r * r, 1e-4);
  return {
    x: -position.x * inv * g + world.wind.x,
    y: -position.y * inv * g + world.wind.y,
    z: -position.z * inv * g + world.wind.z,
  };
}

/**
 * Integrate a shell until it lands, escapes, or times out.
 *
 * This is *the* simulation: the trajectory guide, the shell you watch, and every
 * candidate the AI evaluates all call this function, so they cannot disagree.
 */
export function simulateShot(
  origin: Vec3,
  velocity: Vec3,
  world: SimWorld,
  options: SimOptions = {},
): ShotPath {
  const collectPath = options.collectPath !== false;
  const dt = tuning.simStep;
  const maxTime = tuning.maxFlightTime;
  const escapeRadius = world.radius * 3.5;

  let p: Vec3 = { ...origin };
  let v: Vec3 = { ...velocity };
  let t = 0;
  let apoapsis = len(p);
  const points: Vec3[] = collectPath ? [{ ...p }] : [];
  // A tank is live from the first step unless the shell starts inside its hit sphere —
  // which is how a tank avoids detonating a shell in its own barrel without ever
  // becoming immune to one flying at it.
  const armed = new Map<TankId, boolean>();
  for (const tank of world.tanks) {
    armed.set(tank.id, dist(origin, tank.position) > tank.hitRadius * 1.25);
  }

  while (t < maxTime) {
    const prev = p;
    // Velocity Verlet keeps long orbital arcs stable at this timestep.
    const a0 = acceleration(world, p);
    const mid = mulAdd(v, a0, dt * 0.5);
    p = mulAdd(p, mid, dt);
    const a1 = acceleration(world, p);
    v = mulAdd(mid, a1, dt * 0.5);
    t += dt;

    const r = len(p);
    if (r > apoapsis) apoapsis = r;
    if (collectPath) points.push({ ...p });

    if (r > escapeRadius) {
      return { points, impact: null, escaped: true, flightTime: t, apoapsis };
    }

    // Direct hit on a tank.
    for (const tank of world.tanks) {
      const dx = p.x - tank.position.x;
      const dy = p.y - tank.position.y;
      const dz = p.z - tank.position.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      const rr = tank.hitRadius * tank.hitRadius;
      if (!armed.get(tank.id)) {
        if (d2 > rr * 1.6) armed.set(tank.id, true);
        continue;
      }
      if (d2 <= rr) {
        return {
          points,
          impact: { kind: 'tank', position: p, dir: norm(p), tankId: tank.id },
          escaped: false,
          flightTime: t,
          apoapsis,
        };
      }
    }

    // Ground or water.
    const dir = norm(p);
    if (r <= groundRadius(world, dir)) {
      const hit = bisectImpact(world, prev, p);
      if (collectPath) points[points.length - 1] = hit;
      const hitDir = norm(hit);
      const kind: ImpactKind = world.hasOcean && world.heightAt(hitDir) < world.seaLevel ? 'water' : 'terrain';
      return {
        points,
        impact: { kind, position: hit, dir: hitDir },
        escaped: false,
        flightTime: t,
        apoapsis,
      };
    }
  }

  return { points, impact: null, escaped: true, flightTime: t, apoapsis };
}

/** Refine the crossing point between the last airborne sample and the first buried one. */
function bisectImpact(world: SimWorld, outside: Vec3, inside: Vec3): Vec3 {
  let lo = outside;
  let hi = inside;
  for (let i = 0; i < 14; i++) {
    const mid: Vec3 = {
      x: (lo.x + hi.x) * 0.5,
      y: (lo.y + hi.y) * 0.5,
      z: (lo.z + hi.z) * 0.5,
    };
    const dir = norm(mid);
    if (len(mid) <= groundRadius(world, dir)) hi = mid;
    else lo = mid;
  }
  return hi;
}
