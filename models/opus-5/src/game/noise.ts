import type { Vec3 } from './vec';
import { makeRng } from './rng';

/** Seeded 3D gradient (Perlin) noise plus the fBm/ridged stacks the planet is built from. */
export class Noise3D {
  private perm = new Uint8Array(512);

  constructor(seed: string | number) {
    const rng = makeRng(seed);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = p[i];
      p[i] = p[j];
      p[j] = t;
    }
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
  }

  private grad(hash: number, x: number, y: number, z: number): number {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }

  /** Raw noise in roughly [-1, 1]. */
  at(x: number, y: number, z: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const Z = Math.floor(z) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const zf = z - Math.floor(z);
    const u = xf * xf * xf * (xf * (xf * 6 - 15) + 10);
    const v = yf * yf * yf * (yf * (yf * 6 - 15) + 10);
    const w = zf * zf * zf * (zf * (zf * 6 - 15) + 10);
    const p = this.perm;
    const A = p[X] + Y;
    const AA = p[A] + Z;
    const AB = p[A + 1] + Z;
    const B = p[X + 1] + Y;
    const BA = p[B] + Z;
    const BB = p[B + 1] + Z;
    const lerp = (t: number, a: number, b: number) => a + t * (b - a);
    return lerp(
      w,
      lerp(
        v,
        lerp(u, this.grad(p[AA], xf, yf, zf), this.grad(p[BA], xf - 1, yf, zf)),
        lerp(u, this.grad(p[AB], xf, yf - 1, zf), this.grad(p[BB], xf - 1, yf - 1, zf)),
      ),
      lerp(
        v,
        lerp(u, this.grad(p[AA + 1], xf, yf, zf - 1), this.grad(p[BA + 1], xf - 1, yf, zf - 1)),
        lerp(
          u,
          this.grad(p[AB + 1], xf, yf - 1, zf - 1),
          this.grad(p[BB + 1], xf - 1, yf - 1, zf - 1),
        ),
      ),
    );
  }

  /** Fractal Brownian motion — broad continents. Result roughly [-1, 1]. */
  fbm(d: Vec3, octaves: number, frequency: number, lacunarity = 2.05, gain = 0.5): number {
    let amp = 1;
    let freq = frequency;
    let sum = 0;
    let norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum += amp * this.at(d.x * freq + i * 13.7, d.y * freq - i * 7.3, d.z * freq + i * 21.1);
      norm += amp;
      amp *= gain;
      freq *= lacunarity;
    }
    return sum / norm;
  }

  /** Ridged multifractal — sharp mountain crests. Result roughly [0, 1]. */
  ridged(d: Vec3, octaves: number, frequency: number, lacunarity = 2.1, gain = 0.5): number {
    let amp = 1;
    let freq = frequency;
    let sum = 0;
    let norm = 0;
    for (let i = 0; i < octaves; i++) {
      const n = 1 - Math.abs(this.at(d.x * freq - i * 5.1, d.y * freq + i * 17.9, d.z * freq - i * 3.3));
      sum += amp * n * n;
      norm += amp;
      amp *= gain;
      freq *= lacunarity;
    }
    return sum / norm;
  }
}
