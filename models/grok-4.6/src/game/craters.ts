import { angularDistance, length, type Vec3 } from './math.ts'
import { paintVertex, type Planet } from './planet.ts'

export interface CarveResult {
  carved: boolean
  updated: number
}

export function carveCrater(
  planet: Planet,
  impact: Vec3,
  radius: number,
  depth: number,
  protectedDirs: Vec3[],
  footprint: number,
): CarveResult {
  const impactR = length(impact)
  if (impactR < 0.2) return { carved: false, updated: 0 }
  if (impactR < planet.seaLevel - 0.04) return { carved: false, updated: 0 }

  const angRadius = radius / Math.max(planet.baseRadius, impactR)
  const footAng = footprint / Math.max(planet.baseRadius, impactR)
  let updated = 0

  for (let lat = 0; lat < planet.lats; lat += 1) {
    const phi = (lat / (planet.lats - 1)) * Math.PI - Math.PI / 2
    for (let lon = 0; lon < planet.lons; lon += 1) {
      const idx = lat * planet.lons + lon
      const h = planet.heights[idx]!
      if (h < planet.seaLevel - 0.02) continue
      const theta = (lon / planet.lons) * Math.PI * 2
      const dir: Vec3 = [Math.cos(phi) * Math.sin(theta), Math.sin(phi), Math.cos(phi) * Math.cos(theta)]
      const ang = angularDistance(dir, impact)
      if (ang > angRadius) continue
      let blocked = false
      for (const tank of protectedDirs) {
        if (angularDistance(dir, tank) < footAng) {
          blocked = true
          break
        }
      }
      if (blocked) continue
      const t = 1 - ang / angRadius
      const bowl = t * t
      const next = Math.max(planet.baseRadius * 0.72, h - depth * bowl)
      if (next < h - 1e-4) {
        planet.heights[idx] = next
        paintVertex(planet, idx)
        updated += 1
      }
    }
  }

  return { carved: updated > 0, updated }
}
