import { describe, expect, it } from 'vitest';
import { directionToFaceUV, faceDirection } from '../src/game/cubesphere';
import { hashSeed, makeRng } from '../src/game/rng';
import {
  aimDirection,
  angleBetween,
  bearingOf,
  dot,
  norm,
  surfaceFrame,
} from '../src/game/vec';

describe('seeded rng', () => {
  it('reproduces the same stream for the same seed', () => {
    const a = makeRng('SEED-1');
    const b = makeRng('SEED-1');
    const c = makeRng('SEED-2');
    const first = Array.from({ length: 8 }, () => a());
    const second = Array.from({ length: 8 }, () => b());
    expect(first).toEqual(second);
    expect(first).not.toEqual(Array.from({ length: 8 }, () => c()));
  });

  it('stays inside its declared ranges', () => {
    const rng = makeRng('RANGES');
    for (let i = 0; i < 500; i++) {
      expect(rng.range(-3, 7)).toBeGreaterThanOrEqual(-3);
      expect(rng.jitter(2)).toBeLessThanOrEqual(2);
      expect(rng.int(1, 4)).toBeLessThanOrEqual(4);
    }
    expect(hashSeed('a')).not.toBe(hashSeed('b'));
  });
});

describe('cube sphere addressing', () => {
  it('round-trips every face exactly', () => {
    for (let face = 0; face < 6; face++) {
      for (const u of [-0.999, -0.6, 0, 0.37, 0.999]) {
        for (const v of [-0.999, -0.2, 0, 0.81, 0.999]) {
          const d = faceDirection(face, u, v);
          const back = directionToFaceUV(d);
          expect(back.face).toBe(face);
          expect(back.u).toBeCloseTo(u, 6);
          expect(back.v).toBeCloseTo(v, 6);
        }
      }
    }
  });

  it('produces unit directions', () => {
    for (let face = 0; face < 6; face++) {
      const d = faceDirection(face, 0.3, -0.7);
      expect(Math.hypot(d.x, d.y, d.z)).toBeCloseTo(1, 9);
    }
  });

  it('maps edge directions onto an edge of whichever face claims them', () => {
    // A direction exactly on a cube edge belongs to two faces; both describe it as an
    // edge sample, which is why heights match seamlessly across the join.
    for (let face = 0; face < 6; face++) {
      for (const [u, v] of [
        [1, 0.3],
        [-1, -0.4],
        [0.2, 1],
        [-0.7, -1],
      ]) {
        const back = directionToFaceUV(faceDirection(face, u, v));
        expect(Math.max(Math.abs(back.u), Math.abs(back.v))).toBeCloseTo(1, 6);
      }
    }
  });

  it('gives neighbouring faces the same direction on a shared edge', () => {
    // +X's u = +1 edge and -Z's u = -1 edge describe the same great-circle arc.
    const a = faceDirection(0, 1, 0.4);
    const b = faceDirection(5, -1, 0.4);
    expect(angleBetween(a, b)).toBeCloseTo(0, 9);
  });
});

describe('surface frames and bearings', () => {
  it('builds an orthonormal frame perpendicular to the surface', () => {
    const frame = surfaceFrame({ x: 3, y: 4, z: -5 });
    expect(dot(frame.up, frame.north)).toBeCloseTo(0, 9);
    expect(dot(frame.up, frame.east)).toBeCloseTo(0, 9);
    expect(dot(frame.north, frame.east)).toBeCloseTo(0, 9);
  });

  it('round-trips bearing through a direction', () => {
    const frame = surfaceFrame({ x: 0, y: 0, z: 10 });
    for (const bearing of [0, 37, 90, 180, 271, 359]) {
      const d = aimDirection(frame, bearing, 0);
      expect(bearingOf(frame, d)).toBeCloseTo(bearing, 4);
    }
  });

  it('raises the aim above the tangent plane as elevation grows', () => {
    const frame = surfaceFrame({ x: 0, y: 8, z: 0 });
    const flat = aimDirection(frame, 20, 0);
    const steep = aimDirection(frame, 20, 60);
    expect(dot(flat, frame.up)).toBeCloseTo(0, 9);
    expect(dot(steep, frame.up)).toBeCloseTo(Math.sin((60 * Math.PI) / 180), 6);
  });

  it('normalises degenerate vectors instead of producing NaN', () => {
    const n = norm({ x: 0, y: 0, z: 0 });
    expect(Number.isFinite(n.x + n.y + n.z)).toBe(true);
  });
});
