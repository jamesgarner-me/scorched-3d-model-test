import { add, addScaled, length, normalize, scale, type Vec3 } from './math.ts'
import type { SimRequest, SimResult } from './types.ts'

export const SIM_DT = 1 / 60

export function simulateBallistic(req: SimRequest): SimResult {
  const path: Vec3[] = []
  let pos: Vec3 = [req.origin[0], req.origin[1], req.origin[2]]
  let vel: Vec3 = [req.velocity[0], req.velocity[1], req.velocity[2]]
  const dt = req.dt
  const maxSteps = Math.max(8, Math.ceil(req.maxTime / dt))

  const outward = normalize(pos)
  const surface = req.sampleHeight(outward)
  const radial = length(pos)
  if (radial < surface + 0.2) {
    pos = scale(outward, surface + 0.28)
  }

  path.push([pos[0], pos[1], pos[2]])

  for (let i = 0; i < maxSteps; i += 1) {
    const r = length(pos)
    if (r < 0.2) break
    const inward = scale(normalize(pos), -req.gravity)
    const acc = add(inward, req.wind)
    vel = addScaled(vel, acc, dt)
    const next = addScaled(pos, vel, dt)
    const nextDir = normalize(next)
    const nextR = length(next)
    const terrain = req.sampleHeight(nextDir)
    if (nextR <= terrain) {
      const prevR = length(pos)
      const prevTerrain = req.sampleHeight(normalize(pos))
      const a = prevR - prevTerrain
      const b = terrain - nextR
      const t = a + b > 1e-6 ? a / (a + b) : 1
      const hit = addScaled(pos, subSafe(next, pos), clamp01(t))
      const hitDir = normalize(hit)
      const hitPos = scale(hitDir, req.sampleHeight(hitDir))
      path.push(hitPos)
      return { path, impact: hitPos, time: (i + t) * dt }
    }
    pos = next
    path.push([pos[0], pos[1], pos[2]])
  }

  return { path, impact: path[path.length - 1] ?? pos, time: path.length * dt }
}

function subSafe(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}

function clamp01(t: number): number {
  return Math.max(0, Math.min(1, t))
}

export function guidePath(result: SimResult, fraction: number): Vec3[] {
  if (result.path.length <= 2) return result.path.slice(0, 1)
  const count = Math.max(2, Math.floor(result.path.length * fraction))
  return result.path.slice(0, Math.min(count, result.path.length - 1))
}
