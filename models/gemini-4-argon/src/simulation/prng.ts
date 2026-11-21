/**
 * Deterministic seeded PRNG (Mulberry32) and 3D Fractal Simplex/Gradient Noise.
 * Pure TypeScript with zero external dependencies so simulation runs headlessly.
 */

export function hashSeedString(seed: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export class SeededRandom {
  private state: number;

  constructor(seed: string | number) {
    this.state = typeof seed === 'number' ? seed >>> 0 : hashSeedString(seed);
    if (this.state === 0) {
      this.state = 0x6d2b79f5;
    }
  }

  /** Returns a float in [0, 1) */
  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Returns a float in [min, max) */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Returns an integer in [min, max] inclusive */
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  /** Approximate standard normal via Box-Muller */
  gaussian(mean = 0, stdDev = 1): number {
    const u1 = Math.max(1e-7, this.next());
    const u2 = this.next();
    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return z0 * stdDev + mean;
  }
}

const GRAD3: ReadonlyArray<[number, number, number]> = [
  [1, 1, 0],
  [-1, 1, 0],
  [1, -1, 0],
  [-1, -1, 0],
  [1, 0, 1],
  [-1, 0, 1],
  [1, 0, -1],
  [-1, 0, -1],
  [0, 1, 1],
  [0, -1, 1],
  [0, 1, -1],
  [0, -1, -1],
];

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(a: number, b: number, t: number): number {
  return a + t * (b - a);
}

export class Noise3D {
  private perm: Uint8Array;

  constructor(seed: string | number) {
    const rng = new SeededRandom(seed);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
      p[i] = i;
    }
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rng.next() * (i + 1));
      const tmp = p[i];
      p[i] = p[j];
      p[j] = tmp;
    }
    this.perm = new Uint8Array(512);
    for (let i = 0; i < 512; i++) {
      this.perm[i] = p[i & 255];
    }
  }

  private grad(hash: number, x: number, y: number, z: number): number {
    const g = GRAD3[hash % 12];
    return g[0] * x + g[1] * y + g[2] * z;
  }

  /** Evaluates 3D Perlin gradient noise in approximately [-1, 1] */
  sample(x: number, y: number, z: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const Z = Math.floor(z) & 255;

    const fx = x - Math.floor(x);
    const fy = y - Math.floor(y);
    const fz = z - Math.floor(z);

    const u = fade(fx);
    const v = fade(fy);
    const w = fade(fz);

    const A = this.perm[X] + Y;
    const AA = this.perm[A] + Z;
    const AB = this.perm[A + 1] + Z;
    const B = this.perm[X + 1] + Y;
    const BA = this.perm[B] + Z;
    const BB = this.perm[B + 1] + Z;

    return lerp(
      lerp(
        lerp(
          this.grad(this.perm[AA], fx, fy, fz),
          this.grad(this.perm[BA], fx - 1, fy, fz),
          u,
        ),
        lerp(
          this.grad(this.perm[AB], fx, fy - 1, fz),
          this.grad(this.perm[BB], fx - 1, fy - 1, fz),
          u,
        ),
        v,
      ),
      lerp(
        lerp(
          this.grad(this.perm[AA + 1], fx, fy, fz - 1),
          this.grad(this.perm[BA + 1], fx - 1, fy, fz - 1),
          u,
        ),
        lerp(
          this.grad(this.perm[AB + 1], fx, fy - 1, fz - 1),
          this.grad(this.perm[BB + 1], fx - 1, fy - 1, fz - 1),
          u,
        ),
        v,
      ),
      w,
    );
  }

  /** Fractal Brownian Motion (multi-octave 3D noise) */
  fbm(
    x: number,
    y: number,
    z: number,
    octaves = 4,
    lacunarity = 2.05,
    gain = 0.5,
  ): number {
    let total = 0;
    let frequency = 1;
    let amplitude = 1;
    let maxAmplitude = 0;

    for (let i = 0; i < octaves; i++) {
      total += this.sample(x * frequency, y * frequency, z * frequency) * amplitude;
      maxAmplitude += amplitude;
      amplitude *= gain;
      frequency *= lacunarity;
    }

    return total / maxAmplitude;
  }
}

export function createRandomSeed(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = 'ORB-';
  for (let i = 0; i < 6; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}
