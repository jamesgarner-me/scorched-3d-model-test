import { beforeEach, describe, expect, it } from 'vitest';
import { blastDamage, blastProfile, damageToTank } from '../src/game/damage';
import { applyVariance, powerToSpeed, simulateShot, type SimWorld } from '../src/game/physics';
import { makeRng } from '../src/game/rng';
import { resetTuning, tuning } from '../src/game/tuning';
import { aimDirection, angleBetween, dist, dot, len, norm, scale, surfaceFrame } from '../src/game/vec';

/** A featureless test planet: constant terrain radius, no ocean. */
function sphereWorld(overrides: Partial<SimWorld> = {}): SimWorld {
  const radius = 90;
  return {
    radius,
    seaLevel: radius - 10,
    hasOcean: false,
    gravity: 14,
    muzzleScale: 1,
    wind: { x: 0, y: 0, z: 0 },
    heightAt: () => radius,
    tanks: [],
    ...overrides,
  };
}

const START = { x: 0, y: 0, z: 91.5 };

beforeEach(() => resetTuning());

describe('ballistics', () => {
  it('pulls the shell towards the planet centre, not down a fixed axis', () => {
    const world = sphereWorld();
    // Fired straight "up" from a point on the equator of the z axis.
    const path = simulateShot(START, { x: 0, y: 0, z: 12 }, world);
    expect(path.impact).not.toBeNull();
    // It must come back to where it left, not drift along world -Y.
    expect(angleBetween(path.impact!.position, START)).toBeLessThan(0.02);
  });

  it('bends the arc around the curve of the world', () => {
    const world = sphereWorld();
    const frame = surfaceFrame(START);
    const velocity = scale(aimDirection(frame, 0, 30), powerToSpeed(70));
    const path = simulateShot(START, velocity, world);
    expect(path.impact).not.toBeNull();
    // Every sample stays outside the terrain until the moment it lands.
    for (let i = 0; i < path.points.length - 1; i++) {
      expect(len(path.points[i])).toBeGreaterThanOrEqual(world.radius - 0.01);
    }
    // And it travelled a meaningful arc rather than dropping at its feet.
    expect(angleBetween(path.impact!.position, START)).toBeGreaterThan(0.15);
  });

  it('pushes the shell downwind', () => {
    const frame = surfaceFrame(START);
    const velocity = scale(aimDirection(frame, 0, 40), powerToSpeed(70));
    const still = simulateShot(START, velocity, sphereWorld());
    const east = scale(frame.east, 2.5);
    const blown = simulateShot(START, velocity, sphereWorld({ wind: east }));
    const drift = dot(norm(blown.impact!.position), frame.east) - dot(norm(still.impact!.position), frame.east);
    expect(drift).toBeGreaterThan(0);
  });

  it('reports a water impact instead of burying the shell in the seabed', () => {
    const radius = 90;
    const world = sphereWorld({
      hasOcean: true,
      seaLevel: radius,
      // A basin: terrain dips below sea level on the far side of the shot.
      heightAt: (d) => (d.z > 0.985 ? radius + 1 : radius - 6),
    });
    const frame = surfaceFrame(START);
    const velocity = scale(aimDirection(frame, 0, 35), powerToSpeed(70));
    const path = simulateShot({ x: 0, y: 0, z: radius + 2.5 }, velocity, world);
    expect(path.impact?.kind).toBe('water');
    expect(len(path.impact!.position)).toBeCloseTo(radius, 1);
  });

  it('detonates on a direct hit without detonating in its own barrel', () => {
    const frame = surfaceFrame(START);
    const target = { x: 0, y: 0, z: 92 };
    const world = sphereWorld({ tanks: [{ id: 'player', position: target, hitRadius: 2 }] });
    const velocity = scale(aimDirection(frame, 0, 30), powerToSpeed(60));
    const path = simulateShot(START, velocity, world);
    expect(path.impact?.kind).not.toBe('tank');

    const enemy = { id: 'ai' as const, position: { x: 0, y: 6, z: 90 }, hitRadius: 3 };
    const straight = simulateShot(
      { x: 0, y: 0, z: 92 },
      { x: 0, y: 30, z: -6 },
      sphereWorld({ tanks: [enemy] }),
    );
    expect(straight.impact?.kind).toBe('tank');
    expect(straight.impact?.tankId).toBe('ai');
  });

  it('gives up rather than integrating forever when a shell escapes', () => {
    const path = simulateShot(START, { x: 0, y: 0, z: 400 }, sphereWorld());
    expect(path.escaped).toBe(true);
    expect(path.impact).toBeNull();
  });

  it('scales power across the full bar', () => {
    expect(powerToSpeed(0)).toBeLessThan(powerToSpeed(50));
    expect(powerToSpeed(50)).toBeLessThan(powerToSpeed(100));
    expect(powerToSpeed(100)).toBeCloseTo(tuning.muzzleSpeed, 6);
    expect(powerToSpeed(100, 0.5)).toBeCloseTo(tuning.muzzleSpeed * 0.5, 6);
  });
});

describe('shot variance', () => {
  it('perturbs both aim and speed, but only slightly', () => {
    const rng = makeRng('VARIANCE');
    const direction = { x: 0, y: 0, z: 1 };
    let maxAngle = 0;
    let maxSpeedError = 0;
    for (let i = 0; i < 400; i++) {
      const v = applyVariance(direction, 30, rng);
      maxAngle = Math.max(maxAngle, angleBetween(direction, v.direction));
      maxSpeedError = Math.max(maxSpeedError, Math.abs(v.speed - 30) / 30);
    }
    expect(maxAngle).toBeGreaterThan(0);
    expect(maxAngle).toBeLessThan(0.02);
    expect(maxSpeedError).toBeGreaterThan(0);
    expect(maxSpeedError).toBeLessThanOrEqual(tuning.shotVariance);
  });

  it('is switched off entirely when tuned to zero', () => {
    tuning.shotVariance = 0;
    const rng = makeRng('OFF');
    const v = applyVariance({ x: 0, y: 1, z: 0 }, 20, rng);
    expect(v.speed).toBe(20);
    expect(v.direction).toEqual({ x: 0, y: 1, z: 0 });
  });
});

describe('blast damage', () => {
  it('falls from maximum at the centre to exactly zero at the rim', () => {
    expect(blastDamage(0, 10, 200, 1.6)).toBeCloseTo(200);
    expect(blastDamage(10, 10, 200, 1.6)).toBe(0);
    expect(blastDamage(11, 10, 200, 1.6)).toBe(0);
    const near = blastDamage(2, 10, 200, 1.6);
    const far = blastDamage(7, 10, 200, 1.6);
    expect(near).toBeGreaterThan(far);
    expect(far).toBeGreaterThan(0);
  });

  it('takes about two strong hits to finish a full-health tank', () => {
    const profile = blastProfile('terrain');
    const tank = { x: 0, y: 0, z: 90 };
    // Two hits landing right against the hull get it to the edge of destruction.
    const close = damageToTank({ x: 0.4, y: 0, z: 90 }, tank, profile);
    expect(close * 2).toBeGreaterThan(tuning.maxHealth * 0.9);
    // Two distant near-misses do not.
    const grazing = damageToTank({ x: 0, y: 0, z: 90 + profile.radius * 0.75 }, tank, profile);
    expect(grazing * 2).toBeLessThan(tuning.maxHealth);
  });

  it('softens a splash but still reaches a tank on the shoreline', () => {
    const water = blastProfile('water');
    const ground = blastProfile('terrain');
    expect(water.maxDamage).toBeLessThan(ground.maxDamage);
    expect(water.maxDamage).toBeGreaterThan(0);
    const tank = { x: 0, y: 0, z: 90 };
    const shortShot = { x: 0, y: 0, z: 90 + water.radius * 0.35 };
    expect(damageToTank(shortShot, tank, water)).toBeGreaterThan(0);
    expect(dist(shortShot, tank)).toBeLessThan(water.radius);
  });
});
