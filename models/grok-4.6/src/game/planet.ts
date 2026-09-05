import { clamp, dirFromLatLon, latLonFromDir, lerp, type Vec3 } from './math.ts'
import { Noise3 } from './noise.ts'
import { createRng, pickRange, randomUnit } from './rng.ts'
import type { PresetId, WindState } from './types.ts'
import { tuning } from './tuning.ts'

export interface Planet {
  seed: string
  preset: PresetId
  baseRadius: number
  seaLevel: number
  lats: number
  lons: number
  heights: Float32Array
  colors: Float32Array
  gravity: number
  wind: WindState
  heightAmp: number
}

export interface GenerateOptions {
  seed: string
  preset: PresetId
  lats?: number
  lons?: number
  onProgress?: (progress: number, label: string) => void
}

const LABELS = {
  seed: 'Seeding survey core',
  crust: 'Raising the crust',
  paint: 'Painting biomes',
  weather: 'Reading the wind',
} as const

function yieldFrame(): Promise<void> {
  if (typeof requestAnimationFrame === 'function') {
    return new Promise((resolve) => {
      requestAnimationFrame(() => resolve())
    })
  }
  return Promise.resolve()
}

function colorAt(preset: PresetId, h: number, sea: number, peak: number): Vec3 {
  const t = (h - sea) / Math.max(0.001, peak - sea)
  if (preset === 'earth') {
    if (h < sea - 1.6) return [0.03, 0.09, 0.22]
    if (h < sea - 0.35) return [0.05, 0.22, 0.42]
    if (h < sea) return [0.12, 0.45, 0.55]
    if (t < 0.04) return [0.76, 0.7, 0.46]
    if (t < 0.22) return [0.28, 0.48, 0.2]
    if (t < 0.45) return [0.2, 0.38, 0.16]
    if (t < 0.68) return [0.38, 0.32, 0.22]
    if (t < 0.84) return [0.55, 0.55, 0.52]
    return [0.93, 0.95, 0.97]
  }
  if (h < sea) return [0.28, 0.12, 0.08]
  if (t < 0.18) return [0.42, 0.18, 0.1]
  if (t < 0.4) return [0.62, 0.28, 0.14]
  if (t < 0.62) return [0.72, 0.4, 0.2]
  if (t < 0.82) return [0.55, 0.32, 0.2]
  return [0.82, 0.7, 0.55]
}

export async function generatePlanet(options: GenerateOptions): Promise<Planet> {
  const { seed, preset, onProgress } = options
  const lats = options.lats ?? 144
  const lons = options.lons ?? 288
  onProgress?.(0.04, LABELS.seed)
  await yieldFrame()

  const rng = createRng(seed)
  const noise = new Noise3(seed)
  const warp = new Noise3(`${seed}:warp`)
  const radiusMin = tuning.get('radiusMin')
  const radiusMax = Math.max(radiusMin + 1, tuning.get('radiusMax'))
  const baseRadius = pickRange(rng, radiusMin, radiusMax)
  const heightAmp = baseRadius * tuning.get('heightAmp')
  const freq = tuning.get('noiseFreq')
  const seaBias = tuning.get('seaLevelBias')
  const seaLevel =
    preset === 'earth' ? baseRadius + heightAmp * seaBias : baseRadius - heightAmp * 0.92

  const heights = new Float32Array(lats * lons)
  const chunk = Math.max(8, Math.floor(lats / 12))

  for (let lat = 0; lat < lats; lat += 1) {
    const phi = (lat / (lats - 1)) * Math.PI - Math.PI / 2
    for (let lon = 0; lon < lons; lon += 1) {
      const theta = (lon / lons) * Math.PI * 2
      const dir = dirFromLatLon(phi, theta)
      const wx = dir[0] * freq
      const wy = dir[1] * freq
      const wz = dir[2] * freq
      const d0 = warp.fbm(wx * 0.7, wy * 0.7, wz * 0.7, 4) * 0.55
      const continent = noise.fbm(wx + d0, wy + d0, wz - d0, 5)
      const ridges = noise.ridged(wx * 1.6, wy * 1.6, wz * 1.6, 4)
      const detail = noise.sample(wx * 6.5, wy * 6.5, wz * 6.5) * 0.08
      let n: number
      if (preset === 'earth') {
        const land = clamp((continent + 0.12) * 0.72 + ridges * 0.28, -1, 1)
        n = land + detail
      } else {
        const dunes = noise.fbm(wx * 2.2, wy * 0.4, wz * 2.2, 4)
        const pits = Math.pow(Math.max(0, -continent), 1.6) * 0.55
        n = continent * 0.45 + ridges * 0.4 + dunes * 0.2 - pits + detail
      }
      heights[lat * lons + lon] = baseRadius + n * heightAmp
    }
    if (lat % chunk === 0) {
      onProgress?.(0.08 + (lat / lats) * 0.62, LABELS.crust)
      await yieldFrame()
    }
  }

  onProgress?.(0.74, LABELS.paint)
  await yieldFrame()

  let peak = seaLevel
  for (let i = 0; i < heights.length; i += 1) peak = Math.max(peak, heights[i]!)
  const colors = new Float32Array(lats * lons * 3)
  for (let i = 0; i < heights.length; i += 1) {
    const c = colorAt(preset, heights[i]!, seaLevel, peak)
    colors[i * 3] = c[0]
    colors[i * 3 + 1] = c[1]
    colors[i * 3 + 2] = c[2]
  }

  onProgress?.(0.9, LABELS.weather)
  await yieldFrame()

  const windScale = preset === 'earth' ? tuning.get('windEarth') : tuning.get('windMars')
  const windDir = randomUnit(rng)
  const pole: Vec3 = [0, 1, 0]
  let tangent: Vec3 = [
    windDir[1] * pole[2] - windDir[2] * pole[1],
    windDir[2] * pole[0] - windDir[0] * pole[2],
    windDir[0] * pole[1] - windDir[1] * pole[0],
  ]
  const tLen = Math.hypot(tangent[0], tangent[1], tangent[2])
  if (tLen < 1e-6) tangent = [1, 0, 0]
  else {
    tangent = [tangent[0] / tLen, tangent[1] / tLen, tangent[2] / tLen]
  }
  const strength = windScale * pickRange(rng, 0.65, 1.15)
  const vector: Vec3 = [tangent[0] * strength, tangent[1] * strength, tangent[2] * strength]
  const wind: WindState = {
    vector,
    strength,
    bearing: Math.atan2(vector[0], vector[2]),
  }

  const gravity = preset === 'earth' ? tuning.get('gravityEarth') : tuning.get('gravityMars')
  onProgress?.(1, 'Survey complete')

  return {
    seed,
    preset,
    baseRadius,
    seaLevel,
    lats,
    lons,
    heights,
    colors,
    gravity,
    wind,
    heightAmp,
  }
}

export function sampleHeight(planet: Planet, dir: Vec3): number {
  const { lat, lon } = latLonFromDir(dir)
  const v = ((lat + Math.PI / 2) / Math.PI) * (planet.lats - 1)
  const uRaw = ((lon + Math.PI) / (Math.PI * 2)) * planet.lons
  const u = ((uRaw % planet.lons) + planet.lons) % planet.lons
  const lat0 = clamp(Math.floor(v), 0, planet.lats - 2)
  const lon0 = Math.floor(u) % planet.lons
  const lon1 = (lon0 + 1) % planet.lons
  const fu = u - Math.floor(u)
  const fv = v - lat0
  const h00 = planet.heights[lat0 * planet.lons + lon0]!
  const h10 = planet.heights[lat0 * planet.lons + lon1]!
  const h01 = planet.heights[(lat0 + 1) * planet.lons + lon0]!
  const h11 = planet.heights[(lat0 + 1) * planet.lons + lon1]!
  return lerp(lerp(h00, h10, fu), lerp(h01, h11, fu), fv)
}

export function isWater(planet: Planet, dir: Vec3): boolean {
  return sampleHeight(planet, dir) < planet.seaLevel - 0.04
}

export function surfacePoint(planet: Planet, dir: Vec3): Vec3 {
  const h = Math.max(sampleHeight(planet, dir), planet.seaLevel)
  const n = latLonFromDir(dir)
  const d = dirFromLatLon(n.lat, n.lon)
  return [d[0] * h, d[1] * h, d[2] * h]
}

export function vertexDir(planet: Planet, lat: number, lon: number): Vec3 {
  const phi = (lat / (planet.lats - 1)) * Math.PI - Math.PI / 2
  const theta = (lon / planet.lons) * Math.PI * 2
  return dirFromLatLon(phi, theta)
}

export function paintVertex(planet: Planet, index: number): void {
  const peak = planet.baseRadius + planet.heightAmp
  const h = planet.heights[index]!
  const c = colorAt(planet.preset, h, planet.seaLevel, peak)
  const scar = h < planet.seaLevel + 0.05 ? 1 : 0.78
  planet.colors[index * 3] = c[0] * scar
  planet.colors[index * 3 + 1] = c[1] * scar
  planet.colors[index * 3 + 2] = c[2] * scar
}

export function slopeAt(planet: Planet, lat: number, lon: number): number {
  const h = planet.heights[lat * planet.lons + lon]!
  const latA = clamp(lat - 1, 0, planet.lats - 1)
  const latB = clamp(lat + 1, 0, planet.lats - 1)
  const lonA = (lon + planet.lons - 1) % planet.lons
  const lonB = (lon + 1) % planet.lons
  const dLat = Math.abs(planet.heights[latA * planet.lons + lon]! - planet.heights[latB * planet.lons + lon]!)
  const dLon = Math.abs(planet.heights[lat * planet.lons + lonA]! - planet.heights[lat * planet.lons + lonB]!)
  return (dLat + dLon) / Math.max(0.001, h * 0.08)
}

export function findLandingSites(planet: Planet, seed: string): { player: Vec3; enemy: Vec3 } {
  const rng = createRng(`${seed}:sites`)
  const candidates: { dir: Vec3; lat: number; lon: number }[] = []
  for (let lat = 8; lat < planet.lats - 8; lat += 2) {
    for (let lon = 0; lon < planet.lons; lon += 3) {
      const h = planet.heights[lat * planet.lons + lon]!
      if (h < planet.seaLevel + planet.heightAmp * 0.08) continue
      if (slopeAt(planet, lat, lon) > 1.15) continue
      candidates.push({ dir: vertexDir(planet, lat, lon), lat, lon })
    }
  }
  if (candidates.length < 2) {
    return {
      player: vertexDir(planet, Math.floor(planet.lats * 0.4), 0),
      enemy: vertexDir(planet, Math.floor(planet.lats * 0.6), Math.floor(planet.lons / 2)),
    }
  }
  const player = candidates[Math.floor(rng() * candidates.length)]!
  let best = candidates[0]!
  let bestScore = -1
  for (const c of candidates) {
    const ang = Math.acos(clamp(
      player.dir[0] * c.dir[0] + player.dir[1] * c.dir[1] + player.dir[2] * c.dir[2],
      -1,
      1,
    ))
    if (ang < 1.6 || ang > 2.85) continue
    const score = ang + rng() * 0.15
    if (score > bestScore) {
      bestScore = score
      best = c
    }
  }
  if (bestScore < 0) {
    for (const c of candidates) {
      const ang = Math.acos(clamp(
        player.dir[0] * c.dir[0] + player.dir[1] * c.dir[1] + player.dir[2] * c.dir[2],
        -1,
        1,
      ))
      if (ang > bestScore) {
        bestScore = ang
        best = c
      }
    }
  }
  return { player: player.dir, enemy: best.dir }
}
