import { createNoise3, fbm, ridged, type Noise3 } from './noise'
import { createRng } from './rng'
import type { Preset } from './presets'
import { clamp, dirFromLonLat, lonLatFromDir, type V3 } from './vec'

export type PlanetSpec = {
  seed: string
  preset: Preset
  radius: number
  columns: number // heightmap columns (rows = columns / 2)
  amplitudeScale: number
  featureScale: number
}

export type ProgressFn = (fraction: number, label: string) => void

type RGB = [number, number, number]
const rgb = (hex: string): RGB => [parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255]
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}
const mix = (a: RGB, b: RGB, t: number, out: RGB): RGB => {
  out[0] = a[0] + (b[0] - a[0]) * t
  out[1] = a[1] + (b[1] - a[1]) * t
  out[2] = a[2] + (b[2] - a[2]) * t
  return out
}

const EARTH = {
  deep: rgb('#0f2b47'), shallow: rgb('#2d7a8f'), sand: rgb('#cbbb8d'), grass: rgb('#4e9440'),
  forest: rgb('#2f6b2a'), highland: rgb('#8a7654'), rock: rgb('#6a635c'), snow: rgb('#f3f6f9'), scorch: rgb('#2a2622'),
}
const MARS = {
  low: rgb('#5b2a18'), mid: rgb('#a3522c'), high: rgb('#c77c4f'), dust: rgb('#dca77a'),
  rock: rgb('#6b3a26'), cap: rgb('#ece5dc'), scorch: rgb('#2c1a12'), basin: rgb('#3f1d12'),
}

export type CraterRecord = { point: V3; radius: number; depth: number }

/**
 * Planet: a lat/lon heightmap wrapped on a sphere plus the CPU-side mesh buffers
 * that the renderer uploads. Purely numeric — no Three.js — so it can run headless.
 */
export class Planet {
  readonly W: number
  readonly H: number
  readonly rows: number
  readonly radius: number
  readonly waterRadius: number
  readonly seed: string
  readonly preset: Preset
  readonly heights: Float32Array
  readonly scorch: Float32Array
  readonly positions: Float32Array
  readonly normals: Float32Array
  readonly colors: Float32Array
  readonly indices: Uint32Array
  readonly cosLon: Float64Array
  readonly sinLon: Float64Array
  readonly cosLat: Float64Array
  readonly sinLat: Float64Array
  readonly craters: CraterRecord[] = []
  minHeight = 0
  maxHeight = 0
  /** Increments whenever mesh buffers change; the renderer watches it. */
  version = 0
  /** Vertex range [start, end) touched by the last carve, for partial GPU upload. */
  dirty: { start: number; count: number } | null = null

  constructor(spec: PlanetSpec) {
    this.W = spec.columns
    this.H = spec.columns / 2
    this.rows = this.H + 1
    this.radius = spec.radius
    this.waterRadius = spec.radius + spec.preset.waterLevel
    this.seed = spec.seed
    this.preset = spec.preset
    const cells = this.W * this.rows
    this.heights = new Float32Array(cells)
    this.scorch = new Float32Array(cells)
    const verts = (this.W + 1) * this.rows
    this.positions = new Float32Array(verts * 3)
    this.normals = new Float32Array(verts * 3)
    this.colors = new Float32Array(verts * 3)
    this.indices = new Uint32Array(this.W * this.H * 6)
    this.cosLon = new Float64Array(this.W + 1)
    this.sinLon = new Float64Array(this.W + 1)
    this.cosLat = new Float64Array(this.rows)
    this.sinLat = new Float64Array(this.rows)
    for (let c = 0; c <= this.W; c++) {
      const lon = (c / this.W) * Math.PI * 2
      this.cosLon[c] = Math.cos(lon)
      this.sinLon[c] = Math.sin(lon)
    }
    for (let r = 0; r < this.rows; r++) {
      const lat = -Math.PI / 2 + (r / this.H) * Math.PI
      this.cosLat[r] = Math.cos(lat)
      this.sinLat[r] = Math.sin(lat)
    }
  }

  /** Height (units above nominal radius) at continuous lon/lat, bilinear. */
  heightAtLonLat(lon: number, lat: number): number {
    const W = this.W, H = this.H
    let fx = (lon / (Math.PI * 2)) * W
    fx = ((fx % W) + W) % W
    const fy = clamp(((lat + Math.PI / 2) / Math.PI) * H, 0, H - 1e-6)
    const c0 = Math.floor(fx), r0 = Math.floor(fy)
    const c1 = (c0 + 1) % W, r1 = Math.min(r0 + 1, H)
    const tx = fx - c0, ty = fy - r0
    const h = this.heights
    const a = h[r0 * W + c0], b = h[r0 * W + c1], c = h[r1 * W + c0], d = h[r1 * W + c1]
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty
  }

  /** Terrain radius along the direction of point p. */
  radiusAt(p: V3): number {
    const { lon, lat } = lonLatFromDir(p)
    return this.radius + this.heightAtLonLat(lon, lat)
  }

  /** Surface point (on terrain, or on water if below water level) in direction d. */
  surfacePoint(d: V3, allowWater = false): V3 {
    const { lon, lat } = lonLatFromDir(d)
    let r = this.radius + this.heightAtLonLat(lon, lat)
    if (allowWater && r < this.waterRadius) r = this.waterRadius
    const u = dirFromLonLat(lon, lat)
    return { x: u.x * r, y: u.y * r, z: u.z * r }
  }

  isWaterAt(p: V3): boolean {
    return this.radiusAt(p) < this.waterRadius
  }

  /** Approximate slope (0 flat .. 1 vertical) around a direction, from height differences. */
  slopeAt(p: V3): number {
    const { lon, lat } = lonLatFromDir(p)
    const dl = 1.5 / this.radius
    const c = Math.max(0.05, Math.cos(lat))
    const dhLon = (this.heightAtLonLat(lon + dl / c, lat) - this.heightAtLonLat(lon - dl / c, lat)) / (2 * dl * this.radius)
    const dhLat = (this.heightAtLonLat(lon, clamp(lat + dl, -Math.PI / 2, Math.PI / 2)) - this.heightAtLonLat(lon, clamp(lat - dl, -Math.PI / 2, Math.PI / 2))) / (2 * dl * this.radius)
    const g = Math.sqrt(dhLon * dhLon + dhLat * dhLat)
    return g / Math.sqrt(1 + g * g)
  }

  // ---- mesh building -----------------------------------------------------

  private cellIndex(r: number, c: number): number {
    return r * this.W + (((c % this.W) + this.W) % this.W)
  }

  private posInto(r: number, c: number, out: Float64Array, o: number) {
    r = clamp(r, 0, this.H)
    const cw = ((c % this.W) + this.W) % this.W
    const rad = this.radius + this.heights[r * this.W + cw]
    const cl = this.cosLat[r]
    out[o] = rad * cl * this.cosLon[cw]
    out[o + 1] = rad * this.sinLat[r]
    out[o + 2] = rad * cl * this.sinLon[cw]
  }

  private scratch = new Float64Array(15)

  /** Recompute position, normal and colour for every vertex in rows [r0, r1]. */
  updateRows(r0: number, r1: number) {
    const W = this.W, s = this.scratch
    r0 = clamp(r0, 0, this.H)
    r1 = clamp(r1, 0, this.H)
    const isEarth = this.preset.id === 'earth'
    const tmp: RGB = [0, 0, 0]
    for (let r = r0; r <= r1; r++) {
      const lat = -Math.PI / 2 + (r / this.H) * Math.PI
      for (let c = 0; c <= W; c++) {
        const vi = (r * (W + 1) + c) * 3
        this.posInto(r, c, s, 0)
        this.posInto(r, c + 1, s, 3)
        this.posInto(r, c - 1, s, 6)
        this.posInto(r + 1, c, s, 9)
        this.posInto(r - 1, c, s, 12)
        const ex = s[3] - s[6], ey = s[4] - s[7], ez = s[5] - s[8]
        const nx = s[9] - s[12], ny = s[10] - s[13], nz = s[11] - s[14]
        let cx = ey * nz - ez * ny, cy = ez * nx - ex * nz, cz = ex * ny - ey * nx
        const len = Math.sqrt(cx * cx + cy * cy + cz * cz)
        const px = s[0], py = s[1], pz = s[2]
        const pl = Math.sqrt(px * px + py * py + pz * pz) || 1
        const ux = px / pl, uy = py / pl, uz = pz / pl
        if (len < 1e-9) { cx = ux; cy = uy; cz = uz }
        else {
          cx /= len; cy /= len; cz /= len
          if (cx * ux + cy * uy + cz * uz < 0) { cx = -cx; cy = -cy; cz = -cz }
        }
        this.positions[vi] = px; this.positions[vi + 1] = py; this.positions[vi + 2] = pz
        this.normals[vi] = cx; this.normals[vi + 1] = cy; this.normals[vi + 2] = cz
        const ci = this.cellIndex(r, c)
        const h = this.heights[ci] - this.preset.waterLevel
        const flat = cx * ux + cy * uy + cz * uz
        const slope = 1 - flat
        const col = isEarth ? this.earthColor(h, lat, slope, tmp) : this.marsColor(h, lat, slope, tmp)
        const sc = this.scorch[ci]
        if (sc > 0) mix(col, isEarth ? EARTH.scorch : MARS.scorch, sc * 0.85, col)
        this.colors[vi] = col[0]; this.colors[vi + 1] = col[1]; this.colors[vi + 2] = col[2]
      }
    }
  }

  private earthColor(h: number, lat: number, slope: number, out: RGB): RGB {
    const absLat = Math.abs(lat) * (180 / Math.PI)
    if (h < 0) {
      mix(EARTH.deep, EARTH.shallow, smoothstep(-4, 0, h), out)
    } else if (h < 0.5) {
      mix(EARTH.sand, EARTH.grass, smoothstep(0.15, 0.5, h), out)
    } else if (h < 2.4) {
      mix(EARTH.grass, EARTH.forest, smoothstep(0.5, 1.6, h), out)
      mix(out, EARTH.highland, smoothstep(1.6, 2.4, h), out)
    } else {
      mix(EARTH.highland, EARTH.rock, smoothstep(2.4, 3.2, h), out)
    }
    if (h > 0) mix(out, EARTH.rock, smoothstep(0.18, 0.4, slope) * 0.8, out)
    const snow = Math.max(smoothstep(this.preset.snowLine - 0.6, this.preset.snowLine + 0.4, h), smoothstep(this.preset.polarCap - 6, this.preset.polarCap + 2, absLat))
    if (h > -0.2 || absLat > this.preset.polarCap) mix(out, EARTH.snow, snow * (1 - smoothstep(0.45, 0.7, slope) * 0.6), out)
    return out
  }

  private marsColor(h: number, lat: number, slope: number, out: RGB): RGB {
    const absLat = Math.abs(lat) * (180 / Math.PI)
    const hh = h + 6
    if (hh < 0) mix(MARS.basin, MARS.low, smoothstep(-4, 0, hh), out)
    else if (hh < 3) mix(MARS.low, MARS.mid, smoothstep(0, 3, hh), out)
    else if (hh < 6) mix(MARS.mid, MARS.high, smoothstep(3, 6, hh), out)
    else mix(MARS.high, MARS.dust, smoothstep(6, 9, hh), out)
    mix(out, MARS.rock, smoothstep(0.15, 0.4, slope) * 0.85, out)
    const cap = smoothstep(this.preset.polarCap - 4, this.preset.polarCap + 2, absLat)
    if (cap > 0) mix(out, MARS.cap, cap * (1 - slope), out)
    return out
  }

  buildIndices() {
    const W = this.W, stride = W + 1
    let k = 0
    for (let r = 0; r < this.H; r++) {
      for (let c = 0; c < W; c++) {
        const a = r * stride + c, b = a + 1, cc = a + stride, d = cc + 1
        this.indices[k++] = a; this.indices[k++] = cc; this.indices[k++] = b
        this.indices[k++] = b; this.indices[k++] = cc; this.indices[k++] = d
      }
    }
  }

  // ---- craters -----------------------------------------------------------

  /**
   * Carve a bowl-shaped crater (terrain removal only) at a surface point.
   * Cells inside any tank footprint are left untouched so tanks never float.
   * Returns false when the impact is on water (splash, no crater).
   */
  carve(point: V3, craterRadius: number, depth: number, footprints: V3[], footprintRadius: number): boolean {
    if (this.isWaterAt(point)) return false
    const { lon, lat } = lonLatFromDir(point)
    const d0 = dirFromLonLat(lon, lat)
    const ang = craterRadius / this.radius
    const H = this.H, W = this.W
    const rMin = Math.max(0, Math.floor(((lat - ang + Math.PI / 2) / Math.PI) * H) - 1)
    const rMax = Math.min(H, Math.ceil(((lat + ang + Math.PI / 2) / Math.PI) * H) + 1)
    const fpDirs = footprints.map((p) => {
      const ll = lonLatFromDir(p)
      return dirFromLonLat(ll.lon, ll.lat)
    })
    const fpAng = footprintRadius / this.radius
    const blendAng = 1.2 / this.radius
    for (let r = rMin; r <= rMax; r++) {
      const cl = this.cosLat[r], sl = this.sinLat[r]
      const span = cl < 0.02 ? Math.PI : Math.min(Math.PI, ang / cl)
      const cMin = Math.floor(((lon - span) / (Math.PI * 2)) * W) - 1
      const cMax = Math.ceil(((lon + span) / (Math.PI * 2)) * W) + 1
      const cCount = Math.min(W, cMax - cMin + 1)
      for (let i = 0; i < cCount; i++) {
        const c = ((cMin + i) % W + W) % W
        const ux = cl * this.cosLon[c], uy = sl, uz = cl * this.sinLon[c]
        const cosA = ux * d0.x + uy * d0.y + uz * d0.z
        const a = Math.acos(clamp(cosA, -1, 1))
        if (a >= ang) continue
        const t = a / ang
        let cut = depth * (1 - t * t)
        // Protect tank footprints with a soft edge.
        for (const f of fpDirs) {
          const fa = Math.acos(clamp(ux * f.x + uy * f.y + uz * f.z, -1, 1))
          if (fa < fpAng + blendAng) cut *= smoothstep(fpAng, fpAng + blendAng, fa)
        }
        if (cut <= 0) continue
        const ci = r * W + c
        this.heights[ci] -= cut
        this.scorch[ci] = Math.min(1, this.scorch[ci] + (1 - t) * 0.9)
      }
    }
    this.craters.push({ point: { ...point }, radius: craterRadius, depth })
    const ur0 = Math.max(0, rMin - 1), ur1 = Math.min(H, rMax + 1)
    this.updateRows(ur0, ur1)
    this.dirty = { start: ur0 * (W + 1), count: (ur1 - ur0 + 1) * (W + 1) }
    this.version++
    return true
  }
}

// ---- generation ----------------------------------------------------------

type HeightFn = (x: number, y: number, z: number) => number

function earthHeightFn(noise: Noise3, spec: PlanetSpec): HeightFn {
  const amp = spec.radius * spec.preset.amplitude * spec.amplitudeScale
  const fs = spec.featureScale
  const bias = spec.preset.continentBias
  return (x, y, z) => {
    const cont = fbm(noise, x * 1.3 * fs, y * 1.3 * fs, z * 1.3 * fs, 4, 2.1, 0.5) + bias
    const detail = fbm(noise, x * 5 * fs + 31.7, y * 5 * fs - 12.3, z * 5 * fs + 7.1, 5, 2.2, 0.5)
    const mount = ridged(noise, x * 2.6 * fs - 55.1, y * 2.6 * fs + 21.9, z * 2.6 * fs - 3.3, 5, 2.1, 0.5)
    const mountMask = smoothstep(0.08, 0.45, cont) * smoothstep(0.1, 0.6, fbm(noise, x * 0.9 * fs + 90, y * 0.9 * fs, z * 0.9 * fs - 40, 2) + 0.35)
    const land = smoothstep(-0.06, 0.1, cont)
    const oceanH = -0.35 - 0.5 * clamp(-cont, 0, 1) + 0.18 * detail
    const landH = 0.08 + 0.22 * clamp(cont, 0, 1) + 0.28 * detail + Math.pow(mount, 1.6) * 0.95 * mountMask
    return (oceanH + (landH - oceanH) * land) * amp
  }
}

function marsHeightFn(noise: Noise3, spec: PlanetSpec, rng: ReturnType<typeof createRng>): HeightFn {
  const amp = spec.radius * spec.preset.amplitude * spec.amplitudeScale
  const fs = spec.featureScale
  // Ancient impact basins: bowls with raised rims.
  const basins = Array.from({ length: 14 }, () => {
    const d = dirFromLonLat(rng.range(0, Math.PI * 2), Math.asin(rng.range(-0.95, 0.95)))
    return { d, r: rng.range(0.05, 0.22), depth: rng.range(0.25, 0.7) }
  })
  return (x, y, z) => {
    const base = fbm(noise, x * 1.5 * fs, y * 1.5 * fs, z * 1.5 * fs, 6, 2.05, 0.55) * 0.55 + 0.15
    const ridge = ridged(noise, x * 2.4 * fs + 17.3, y * 2.4 * fs - 41.7, z * 2.4 * fs + 5.5, 5, 2.1, 0.5)
    const ridgeMask = smoothstep(-0.1, 0.4, fbm(noise, x * 0.8 * fs - 70, y * 0.8 * fs + 22, z * 0.8 * fs + 61, 2))
    let h = base + (ridge - 0.45) * 0.7 * ridgeMask
    const dunes = fbm(noise, x * 9 * fs, y * 9 * fs, z * 9 * fs, 3, 2.3, 0.5) * 0.06
    h += dunes
    for (const b of basins) {
      const cosA = x * b.d.x + y * b.d.y + z * b.d.z
      const a = Math.acos(clamp(cosA, -1, 1))
      if (a < b.r * 1.25) {
        const t = a / b.r
        if (t < 1) h -= b.depth * (1 - t * t) * 0.9
        h += b.depth * 0.35 * Math.exp(-Math.pow((t - 1) / 0.12, 2))
      }
    }
    return h * amp
  }
}

const yieldFrame = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

export async function generatePlanet(spec: PlanetSpec, onProgress: ProgressFn): Promise<Planet> {
  const planet = new Planet(spec)
  const noise = createNoise3(spec.seed)
  const rng = createRng(spec.seed + ':features')
  const heightFn = spec.preset.id === 'earth' ? earthHeightFn(noise, spec) : marsHeightFn(noise, spec, rng)
  const { W, rows } = planet
  const chunk = 12
  let minH = Infinity, maxH = -Infinity
  onProgress(0, 'Seeding terrain')
  for (let r0 = 0; r0 < rows; r0 += chunk) {
    const r1 = Math.min(rows, r0 + chunk)
    for (let r = r0; r < r1; r++) {
      const cl = planet.cosLat[r], sl = planet.sinLat[r]
      for (let c = 0; c < W; c++) {
        const h = heightFn(cl * planet.cosLon[c], sl, cl * planet.sinLon[c])
        planet.heights[r * W + c] = h
        if (h < minH) minH = h
        if (h > maxH) maxH = h
      }
    }
    onProgress((r1 / rows) * 0.6, 'Raising mountains')
    await yieldFrame()
  }
  planet.minHeight = minH
  planet.maxHeight = maxH
  onProgress(0.6, 'Painting surface')
  const chunk2 = 24
  for (let r0 = 0; r0 < rows; r0 += chunk2) {
    const r1 = Math.min(rows - 1, r0 + chunk2 - 1)
    planet.updateRows(r0, r1)
    onProgress(0.6 + (r1 / rows) * 0.35, 'Painting surface')
    await yieldFrame()
  }
  onProgress(0.96, 'Stitching mesh')
  planet.buildIndices()
  await yieldFrame()
  onProgress(1, 'Ready')
  planet.version++
  return planet
}
