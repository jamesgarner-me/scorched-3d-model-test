import { aimDirection, clamp, dist, greatCircleBearing, localFrame, rad, type Vec3 } from './math.ts'
import { createRng } from './rng.ts'
import { simulateBallistic, SIM_DT } from './physics.ts'
import type { AiMemory, Difficulty } from './types.ts'
import type { Planet } from './planet.ts'
import { sampleHeight, surfacePoint } from './planet.ts'

export interface AimSolution {
  bearing: number
  elevation: number
  power: number
  miss: number
  solveMs: number
}

export interface SolveArgs {
  planet: Planet
  from: Vec3
  target: Vec3
  difficulty: Difficulty
  memory: AiMemory
  seed: string
  turn: number
  gravity: number
  wind: Vec3
  maxSpeed: number
  minElevation: number
  maxElevation: number
}

function evaluate(
  planet: Planet,
  from: Vec3,
  bearing: number,
  elevation: number,
  power: number,
  gravity: number,
  wind: Vec3,
  maxSpeed: number,
  target: Vec3,
): { impact: Vec3; miss: number } {
  const frame = localFrame(from)
  const dir = aimDirection(frame, bearing, elevation)
  const muzzle = [
    from[0] + dir[0] * 1.6 + frame.up[0] * 0.35,
    from[1] + dir[1] * 1.6 + frame.up[1] * 0.35,
    from[2] + dir[2] * 1.6 + frame.up[2] * 0.35,
  ] as Vec3
  const speed = power * maxSpeed
  const result = simulateBallistic({
    origin: muzzle,
    velocity: [dir[0] * speed, dir[1] * speed, dir[2] * speed],
    gravity,
    wind,
    dt: SIM_DT,
    maxTime: 14,
    sampleHeight: (d) => sampleHeight(planet, d),
  })
  const impact = result.impact ?? result.path[result.path.length - 1]!
  return { impact, miss: dist(impact, target) }
}

export function solveAim(args: SolveArgs): AimSolution {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now()
  const rng = createRng(`${args.seed}:ai:${args.turn}`)
  const baseBearing = greatCircleBearing(args.from, args.target)
  const samples =
    args.difficulty === 'hard' ? 9 : args.difficulty === 'medium' ? 6 : 4
  const refine =
    args.difficulty === 'hard' ? 3 : args.difficulty === 'medium' ? 2 : 1

  let best: AimSolution = {
    bearing: baseBearing,
    elevation: rad(38),
    power: 0.62,
    miss: Number.POSITIVE_INFINITY,
    solveMs: 0,
  }

  const elevMin = args.minElevation
  const elevMax = args.maxElevation

  const search = (b0: number, e0: number, p0: number, spreadB: number, spreadE: number, spreadP: number) => {
    for (let i = 0; i < samples; i += 1) {
      for (let j = 0; j < samples; j += 1) {
        const bearing = b0 + ((i / (samples - 1)) - 0.5) * 2 * spreadB
        const elevation = clamp(
          e0 + ((j / (samples - 1)) - 0.5) * 2 * spreadE,
          rad(elevMin),
          rad(elevMax),
        )
        const power = clamp(p0 + (rng() - 0.5) * spreadP, 0.28, 1)
        const ev = evaluate(
          args.planet,
          args.from,
          bearing,
          elevation,
          power,
          args.gravity,
          args.wind,
          args.maxSpeed,
          args.target,
        )
        if (ev.miss < best.miss) {
          best = { bearing, elevation, power, miss: ev.miss, solveMs: 0 }
        }
      }
    }
  }

  let centerB = baseBearing
  let centerE = rad(36)
  let centerP = 0.6
  if (args.memory.lastAim && args.memory.lastImpact) {
    const err = dist(args.memory.lastImpact, args.target)
    const sign = rng() < 0.5 ? -1 : 1
    const over = args.difficulty === 'easy' ? 1.35 : args.difficulty === 'medium' ? 0.85 : 0.45
    centerB = args.memory.lastAim.bearing + sign * (err / args.planet.baseRadius) * over
    centerE = clamp(args.memory.lastAim.elevation + (rng() - 0.4) * 0.12 * over, rad(elevMin), rad(elevMax))
    centerP = clamp(args.memory.lastAim.power + (rng() - 0.45) * 0.18 * over, 0.3, 1)
  }

  search(centerB, centerE, centerP, 0.55, rad(22), 0.5)
  for (let r = 0; r < refine; r += 1) {
    search(best.bearing, best.elevation, best.power, 0.18 / (r + 1), rad(10) / (r + 1), 0.22 / (r + 1))
  }

  const noiseScale =
    args.difficulty === 'easy' ? 0.22 : args.difficulty === 'medium' ? 0.1 : 0.035
  best.bearing += (rng() * 2 - 1) * noiseScale
  best.elevation = clamp(best.elevation + (rng() * 2 - 1) * noiseScale * 0.5, rad(elevMin), rad(elevMax))
  best.power = clamp(best.power + (rng() * 2 - 1) * noiseScale * 0.4, 0.3, 1)

  if (args.difficulty === 'easy' && rng() < 0.28 && args.memory.lastAim) {
    best.bearing += (best.bearing - args.memory.lastAim.bearing) * 0.8
  }

  const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now()
  best.solveMs = t1 - t0
  return best
}

export function tankWorldPos(planet: Planet, dir: Vec3): Vec3 {
  return surfacePoint(planet, dir)
}
