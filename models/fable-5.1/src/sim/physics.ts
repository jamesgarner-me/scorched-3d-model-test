import type { Planet } from './planet'
import { tune } from './tuning'
import type { V3 } from './vec'

export type TankId = 'player' | 'ai'
export type ShotOutcome = 'terrain' | 'water' | 'tank' | 'lost'

export type TankBody = { id: TankId; pos: V3 }

export type Trajectory = {
  /** xyz triplets, one per sim step, starting at the muzzle. */
  points: Float32Array
  count: number
  dt: number
  flightTime: number
  outcome: ShotOutcome
  impact: V3
  hitTank: TankId | null
  /** Peak distance from the planet centre, for camera framing. */
  apex: number
}

export type ShotParams = { bearing: number; elevation: number; power: number }

/** Circular orbital speed at the surface: the natural speed scale of a planet. */
export const orbitalSpeed = (planet: Planet) => Math.sqrt(planet.preset.gravity * tune('gravityScale') * planet.radius)

/** Muzzle speed for a power in [0, 1], scaled to the planet so every world plays. */
export const speedForPower = (planet: Planet, power: number) =>
  orbitalSpeed(planet) * (tune('minSpeedFrac') + (tune('maxSpeedFrac') - tune('minSpeedFrac')) * power)

/**
 * The one shared ballistic simulation. The trajectory guide, the live shot and
 * the AI all call this, so they can never disagree.
 */
export function simulateShot(planet: Planet, wind: V3, origin: V3, velocity: V3, tanks: TankBody[], shooter: TankId | null): Trajectory {
  const dt = tune('simDt')
  const maxSteps = Math.ceil(tune('maxFlightTime') / dt)
  const g = planet.preset.gravity * tune('gravityScale')
  const windScale = tune('windScale')
  const hitR = tune('tankHitRadius')
  const hitR2 = hitR * hitR
  const escapeR = planet.radius * 6
  const points = new Float32Array((maxSteps + 1) * 3)
  let px = origin.x, py = origin.y, pz = origin.z
  let vx = velocity.x, vy = velocity.y, vz = velocity.z
  let count = 0
  let apex = 0
  let outcome: ShotOutcome = 'lost'
  let impact: V3 = { x: px, y: py, z: pz }
  let hitTank: TankId | null = null
  const pv: V3 = { x: 0, y: 0, z: 0 }

  for (let step = 0; step <= maxSteps; step++) {
    points[count * 3] = px
    points[count * 3 + 1] = py
    points[count * 3 + 2] = pz
    count++
    const r = Math.sqrt(px * px + py * py + pz * pz)
    if (r > apex) apex = r
    const ux = px / r, uy = py / r, uz = pz / r
    // Ground / water contact (skip the very first sample, which sits at the muzzle).
    if (step > 0) {
      pv.x = px; pv.y = py; pv.z = pz
      const terrainR = planet.radiusAt(pv)
      if (r <= terrainR) {
        outcome = 'terrain'
        impact = { x: ux * terrainR, y: uy * terrainR, z: uz * terrainR }
        break
      }
      if (r <= planet.waterRadius && terrainR < planet.waterRadius) {
        outcome = 'water'
        const wr = planet.waterRadius
        impact = { x: ux * wr, y: uy * wr, z: uz * wr }
        break
      }
      let hit = false
      for (const t of tanks) {
        if (t.id === shooter && step * dt < 0.6) continue
        const dx = px - t.pos.x, dy = py - t.pos.y, dz = pz - t.pos.z
        if (dx * dx + dy * dy + dz * dz < hitR2) {
          outcome = 'tank'
          hitTank = t.id
          impact = { x: px, y: py, z: pz }
          hit = true
          break
        }
      }
      if (hit) break
      if (r > escapeR) { outcome = 'lost'; impact = { x: px, y: py, z: pz }; break }
    }
    // Planet-centred gravity plus the tangential component of the global wind.
    const wDot = wind.x * ux + wind.y * uy + wind.z * uz
    const ax = -ux * g + (wind.x - wDot * ux) * windScale
    const ay = -uy * g + (wind.y - wDot * uy) * windScale
    const az = -uz * g + (wind.z - wDot * uz) * windScale
    vx += ax * dt; vy += ay * dt; vz += az * dt
    px += vx * dt; py += vy * dt; pz += vz * dt
  }
  if (outcome === 'lost') {
    const last = (count - 1) * 3
    impact = { x: points[last], y: points[last + 1], z: points[last + 2] }
  }
  return { points: points.subarray(0, count * 3), count, dt, flightTime: (count - 1) * dt, outcome, impact, hitTank, apex }
}
