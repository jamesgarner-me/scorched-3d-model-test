import { FACES, directionToFaceUV, faceDirection } from './cubesphere';
import { Noise3D } from './noise';
import { PRESETS, type Preset, type PresetId } from './presets';
import { makeRng } from './rng';
import { tuning } from './tuning';
import { clamp, norm, type Vec3 } from './vec';

export interface PlanetOptions {
  seed: string;
  preset: PresetId;
  /** Optional explicit radius; otherwise rolled from the preset range. */
  radius?: number;
}

export interface CarveTarget {
  /** Unit direction of a protected footprint (a tank) — terrain here is never removed. */
  dir: Vec3;
  radius: number;
}

export interface CarveResult {
  faces: number[];
  texels: number;
  millis: number;
}

/**
 * A spherical heightfield stored as six square grids (a tangent-warped cube sphere).
 * Heights are absolute radii. Craters subtract from them permanently: nothing here
 * ever raises terrain, heals, fades, or caps the number of craters.
 */
export class Planet {
  readonly seed: string;
  readonly preset: Preset;
  readonly radius: number;
  readonly resolution: number;
  /** Absolute radius of the waterline. Below `minHeight` when the preset has no ocean. */
  seaLevel = 0;
  minHeight = Infinity;
  maxHeight = -Infinity;
  /** Per face: N*N absolute radii. */
  readonly heights: Float32Array[] = [];
  /** Per face: N*N*3 unit directions, precomputed so carving is a dot-product sweep. */
  readonly dirs: Float32Array[] = [];
  /** Per face: N*N accumulated carve depth, used to tint crater floors. */
  readonly carved: Float32Array[] = [];
  /** Faces whose geometry needs re-uploading. */
  readonly dirtyFaces = new Set<number>();
  generationMillis = 0;
  craterCount = 0;

  constructor(options: PlanetOptions) {
    this.seed = options.seed;
    this.preset = PRESETS[options.preset];
    this.resolution = Math.max(16, Math.round(tuning.gridResolution));
    const rng = makeRng(`${options.seed}:radius`);
    const [rMin, rMax] = this.preset.radiusRange;
    this.radius = options.radius ?? Math.round(rng.range(rMin, rMax));
  }

  get hasOcean(): boolean {
    return this.preset.oceanFraction > 0;
  }

  private index(i: number, j: number): number {
    return j * this.resolution + i;
  }

  /** Terrain radius at a direction, bilinearly interpolated. Seams match exactly across faces. */
  heightAt(direction: Vec3): number {
    const d = norm(direction);
    const { face, u, v } = directionToFaceUV(d);
    const n = this.resolution;
    const fx = clamp((u + 1) * 0.5 * (n - 1), 0, n - 1);
    const fy = clamp((v + 1) * 0.5 * (n - 1), 0, n - 1);
    const i0 = Math.min(Math.floor(fx), n - 2);
    const j0 = Math.min(Math.floor(fy), n - 2);
    const tx = fx - i0;
    const ty = fy - j0;
    const h = this.heights[face];
    const h00 = h[this.index(i0, j0)];
    const h10 = h[this.index(i0 + 1, j0)];
    const h01 = h[this.index(i0, j0 + 1)];
    const h11 = h[this.index(i0 + 1, j0 + 1)];
    return (h00 * (1 - tx) + h10 * tx) * (1 - ty) + (h01 * (1 - tx) + h11 * tx) * ty;
  }

  /** Surface point (on terrain, or on the waterline where terrain is submerged). */
  surfacePoint(direction: Vec3, clampToWater = true): Vec3 {
    const d = norm(direction);
    const h = this.heightAt(d);
    const r = clampToWater ? Math.max(h, this.seaLevel) : h;
    return { x: d.x * r, y: d.y * r, z: d.z * r };
  }

  isWater(direction: Vec3): boolean {
    return this.hasOcean && this.heightAt(direction) < this.seaLevel;
  }

  /** Outward surface normal from finite differences of the heightfield. */
  normalAt(direction: Vec3): Vec3 {
    const d = norm(direction);
    const { face } = directionToFaceUV(d);
    const f = FACES[face];
    const eps = 1.4 / this.resolution;
    const sample = (ax: Vec3, s: number): Vec3 => {
      const p = norm({ x: d.x + ax.x * s, y: d.y + ax.y * s, z: d.z + ax.z * s });
      const r = this.heightAt(p);
      return { x: p.x * r, y: p.y * r, z: p.z * r };
    };
    const pu1 = sample(f.t, eps);
    const pu0 = sample(f.t, -eps);
    const pv1 = sample(f.b, eps);
    const pv0 = sample(f.b, -eps);
    const tu = { x: pu1.x - pu0.x, y: pu1.y - pu0.y, z: pu1.z - pu0.z };
    const tv = { x: pv1.x - pv0.x, y: pv1.y - pv0.y, z: pv1.z - pv0.z };
    const nx = tu.y * tv.z - tu.z * tv.y;
    const ny = tu.z * tv.x - tu.x * tv.z;
    const nz = tu.x * tv.y - tu.y * tv.x;
    const cand = norm({ x: nx, y: ny, z: nz });
    // Keep it pointing away from the planet centre.
    const outward = cand.x * d.x + cand.y * d.y + cand.z * d.z >= 0;
    return outward ? cand : { x: -cand.x, y: -cand.y, z: -cand.z };
  }

  /**
   * Permanently lower terrain inside an angular cap.
   * Skips submerged texels (no dredging the seabed) and fades to zero inside a tank
   * footprint so a tank can never be left floating — it can only be killed by blast.
   */
  carve(centre: Vec3, worldRadius: number, depth: number, protect: CarveTarget[] = []): CarveResult {
    const started = now();
    const c = norm(centre);
    const angular = Math.min(worldRadius / this.radius, Math.PI * 0.45);
    const cosLimit = Math.cos(angular);
    const n = this.resolution;
    const touched: number[] = [];
    // A footprint must always span a few grid cells, or bilinear sampling under the
    // tank would still pick up carved neighbours and drop it into a hole.
    const cellAngle = Math.PI / 2 / (n - 1);
    const protects = protect.map((p) => ({
      dir: norm(p.dir),
      angle: Math.min(Math.max(p.radius / this.radius, cellAngle * 2.5), Math.PI * 0.45),
    }));
    let texels = 0;
    const floor = this.hasOcean ? this.seaLevel + 0.02 : -Infinity;

    for (let face = 0; face < 6; face++) {
      const dirs = this.dirs[face];
      const heights = this.heights[face];
      const carved = this.carved[face];
      let faceTouched = false;
      for (let k = 0; k < n * n; k++) {
        const o = k * 3;
        const cd = dirs[o] * c.x + dirs[o + 1] * c.y + dirs[o + 2] * c.z;
        if (cd <= cosLimit) continue;
        if (this.hasOcean && heights[k] < this.seaLevel) continue;
        const t = Math.acos(clamp(cd, -1, 1)) / angular;
        let amount = depth * 0.5 * (1 + Math.cos(Math.PI * clamp(t, 0, 1)));
        for (const p of protects) {
          const pd = dirs[o] * p.dir.x + dirs[o + 1] * p.dir.y + dirs[o + 2] * p.dir.z;
          const inner = Math.acos(clamp(pd, -1, 1)) / p.angle;
          if (inner >= 1) continue;
          // Flat, untouched core under the hull; a ramp out to the footprint edge.
          amount *= smoothstep(0.45, 1, inner);
        }
        if (amount <= 1e-4) continue;
        const next = Math.max(heights[k] - amount, floor);
        if (next >= heights[k]) continue;
        carved[k] += heights[k] - next;
        heights[k] = next;
        this.minHeight = Math.min(this.minHeight, next);
        faceTouched = true;
        texels++;
      }
      if (faceTouched) {
        touched.push(face);
        this.dirtyFaces.add(face);
      }
    }
    if (texels > 0) this.craterCount++;
    return { faces: touched, texels, millis: now() - started };
  }
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

const yieldToHost = (): Promise<void> =>
  new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => resolve());
    else setTimeout(resolve, 0);
  });

export interface GenerationProgress {
  fraction: number;
  label: string;
}

/**
 * Build a planet, yielding to the host between faces so the loading screen can animate.
 * Fully determined by the seed: the same seed always produces the same world.
 */
export async function generatePlanet(
  options: PlanetOptions,
  onProgress?: (p: GenerationProgress) => void,
): Promise<Planet> {
  const started = now();
  const planet = new Planet(options);
  const n = planet.resolution;
  const noise = new Noise3D(`${options.seed}:terrain`);
  const warp = new Noise3D(`${options.seed}:warp`);
  const amplitude = tuning.terrainAmplitude * planet.radius;
  const freq = tuning.continentFrequency;
  const mountains = tuning.mountainStrength;

  for (let face = 0; face < 6; face++) {
    onProgress?.({ fraction: (face / 6) * 0.8, label: `Shaping terrain ${face + 1}/6` });
    const heights = new Float32Array(n * n);
    const dirs = new Float32Array(n * n * 3);
    for (let j = 0; j < n; j++) {
      const v = -1 + (2 * j) / (n - 1);
      for (let i = 0; i < n; i++) {
        const u = -1 + (2 * i) / (n - 1);
        const d = faceDirection(face, u, v);
        const k = j * n + i;
        dirs[k * 3] = d.x;
        dirs[k * 3 + 1] = d.y;
        dirs[k * 3 + 2] = d.z;
        heights[k] = planet.radius + amplitude * shapeTerrain(noise, warp, d, freq, mountains);
      }
    }
    planet.heights.push(heights);
    planet.dirs.push(dirs);
    planet.carved.push(new Float32Array(n * n));
    await yieldToHost();
  }

  onProgress?.({ fraction: 0.85, label: 'Filling oceans' });
  for (const heights of planet.heights) {
    for (let k = 0; k < heights.length; k++) {
      if (heights[k] < planet.minHeight) planet.minHeight = heights[k];
      if (heights[k] > planet.maxHeight) planet.maxHeight = heights[k];
    }
  }

  if (planet.hasOcean) {
    planet.seaLevel = quantileHeight(planet, planet.preset.oceanFraction);
  } else {
    // No ocean: park the waterline below the deepest valley so nothing ever reads as water.
    planet.seaLevel = planet.minHeight - 1;
  }

  await yieldToHost();
  onProgress?.({ fraction: 1, label: 'Ready' });
  planet.generationMillis = now() - started;
  return planet;
}

/** Continents plus ridged mountains, warped so coastlines are not obviously noise-shaped. */
function shapeTerrain(noise: Noise3D, warp: Noise3D, d: Vec3, freq: number, mountains: number): number {
  const w = 0.22;
  const wd: Vec3 = {
    x: d.x + w * warp.fbm(d, 3, 2.1),
    y: d.y + w * warp.fbm({ x: d.x + 5.2, y: d.y - 3.1, z: d.z + 1.7 }, 3, 2.1),
    z: d.z + w * warp.fbm({ x: d.x - 2.4, y: d.y + 6.8, z: d.z - 4.5 }, 3, 2.1),
  };
  const continents = noise.fbm(wd, 6, freq);
  // Push land up and oceans flat-ish, so shorelines are crisp rather than mushy.
  const land = Math.sign(continents) * Math.pow(Math.abs(continents), 0.85);
  const ridge = noise.ridged(wd, 5, freq * 2.9);
  const mask = clamp((land + 0.15) * 2.2, 0, 1);
  return land + mountains * mask * (ridge - 0.35) * 0.9;
}

/** Height below which `fraction` of the surface lies. */
function quantileHeight(planet: Planet, fraction: number): number {
  const samples: number[] = [];
  const stride = 7;
  for (const heights of planet.heights) {
    for (let k = 0; k < heights.length; k += stride) samples.push(heights[k]);
  }
  samples.sort((a, b) => a - b);
  const idx = clamp(Math.floor(samples.length * fraction), 0, samples.length - 1);
  return samples[idx];
}
