import type { Planet } from './planet'
import { simulateShot, speedForPower, type ShotParams, type TankBody } from './physics'
import type { Rng } from './rng'
import { tune } from './tuning'
import { add, aimDirection, bearingTo, dot, frameAt, length, normalize, scale, sub, surfaceDistance, type V3 } from './vec'

export type Difficulty = 'easy' | 'medium' | 'hard'

export const DIFFICULTIES: { id: Difficulty; name: string; blurb: string }[] = [
  { id: 'easy', name: 'Easy', blurb: 'Misses visibly and sometimes overcorrects.' },
  { id: 'medium', name: 'Medium', blurb: 'Walks its shots onto you over a few turns.' },
  { id: 'hard', name: 'Hard', blurb: 'Reads wind and gravity well and learns fast.' },
]

type Tier = { initialOffset: number; turnNoise: number; learnRate: number; budget: number; overcorrect: number }

const TIERS: Record<Difficulty, Tier> = {
  easy: { initialOffset: 16, turnNoise: 5, learnRate: 1.45, budget: 0.25, overcorrect: 0.5 },
  medium: { initialOffset: 9, turnNoise: 2.4, learnRate: 0.7, budget: 0.6, overcorrect: 0.1 },
  hard: { initialOffset: 5, turnNoise: 1.1, learnRate: 0.95, budget: 1, overcorrect: 0 },
}

/**
 * The AI never sees anything the player can't: it aims at the visible enemy
 * position plus its own (wrong) belief about where to aim, refines that belief
 * from where its shots actually land, and fires through the same simulation
 * with the same variance as the player.
 */
export type AiBrain = {
  difficulty: Difficulty
  /** World-space tangent offset added to the target: the AI's aiming error. */
  aimOffset: V3
  turns: number
  lastSolution: ShotParams | null
}

export function createAiBrain(difficulty: Difficulty, rng: Rng): AiBrain {
  const t = TIERS[difficulty]
  const angle = rng.range(0, Math.PI * 2)
  const mag = t.initialOffset * rng.range(0.7, 1.2) * tune('aiErrorScale')
  return { difficulty, aimOffset: { x: Math.cos(angle) * mag, y: 0, z: Math.sin(angle) * mag }, turns: 0, lastSolution: null }
}

export type SolveContext = {
  planet: Planet
  wind: V3
  shooter: TankBody
  muzzleOffset: number
  target: TankBody
  brain: AiBrain
  rng: Rng
}

export type AiSolution = ShotParams & { solveMs: number; predicted: V3; evaluations: number }

/** Solve for a shot that lands near the AI's aim point using the shared simulation. */
export function aiSolve(ctx: SolveContext): AiSolution {
  const t0 = performance.now()
  const { planet, wind, shooter, target, brain, rng } = ctx
  const tier = TIERS[brain.difficulty]
  const frame = frameAt(shooter.pos)
  const tf = frameAt(target.pos)
  // Project the belief offset into the target's tangent plane.
  const off = sub(brain.aimOffset, scale(tf.up, dot(brain.aimOffset, tf.up)))
  const aim = planet.surfacePoint(add(target.pos, off), true)
  const bearing0 = bearingTo(shooter.pos, aim)
  const bodies = [shooter, target]
  let evaluations = 0

  const evaluate = (p: ShotParams) => {
    evaluations++
    const dir = aimDirection(frame, p.bearing, p.elevation)
    const origin = add(shooter.pos, scale(dir, ctx.muzzleOffset))
    const traj = simulateShot(planet, wind, origin, scale(dir, speedForPower(planet, p.power)), bodies, shooter.id)
    if (traj.outcome === 'lost') return { score: 1e9, landing: traj.impact }
    if (traj.hitTank === shooter.id) return { score: 1e8, landing: traj.impact }
    let score = surfaceDistance(traj.impact, aim, planet.radius)
    // Prefer shorter flights when otherwise equal (less wind exposure, less variance).
    score += traj.flightTime * 0.05
    return { score, landing: traj.impact }
  }

  const budget = Math.max(40, Math.round(tune('aiSearchBudget') * tier.budget))
  let best: { p: ShotParams; score: number; landing: V3 } | null = null
  const consider = (p: ShotParams) => {
    p.power = Math.min(1, Math.max(0.05, p.power))
    p.elevation = Math.min(85 * (Math.PI / 180), Math.max(8 * (Math.PI / 180), p.elevation))
    const r = evaluate(p)
    if (!best || r.score < best.score) best = { p, score: r.score, landing: r.landing }
  }

  // Coarse grid over elevation × power at the direct bearing.
  const coarseElev = [20, 30, 40, 50, 60, 70]
  const coarsePow = [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]
  const coarseN = coarseElev.length * coarsePow.length
  const stride = Math.max(1, Math.round(coarseN / Math.max(12, budget * 0.4)))
  let k = 0
  for (const e of coarseElev) {
    for (const pw of coarsePow) {
      if (k++ % stride !== 0) continue
      consider({ bearing: bearing0, elevation: e * (Math.PI / 180), power: pw })
    }
  }
  // Previous turn's solution is a good seed once we have one.
  if (brain.lastSolution) consider({ ...brain.lastSolution })

  // Stochastic local refinement (shrinking neighbourhood).
  let radius = 1
  while (evaluations < budget && best) {
    const b = (best as { p: ShotParams }).p
    consider({
      bearing: b.bearing + rng.gaussian() * 0.12 * radius,
      elevation: b.elevation + rng.gaussian() * 0.14 * radius,
      power: b.power + rng.gaussian() * 0.08 * radius,
    })
    radius = Math.max(0.12, radius * 0.985)
  }

  const result = best as { p: ShotParams; score: number; landing: V3 } | null
  const solution: ShotParams = result ? result.p : { bearing: bearing0, elevation: Math.PI / 4, power: 0.6 }
  brain.lastSolution = { ...solution }
  return { ...solution, solveMs: performance.now() - t0, predicted: result ? result.landing : aim, evaluations }
}

/** Update the AI's belief from where its shot actually landed relative to the target. */
export function aiObserve(brain: AiBrain, landing: V3, target: V3, rng: Rng) {
  const tier = TIERS[brain.difficulty]
  const tf = frameAt(target)
  const miss = sub(landing, target)
  const missT = sub(miss, scale(tf.up, dot(miss, tf.up)))
  const missLen = length(missT)
  // Very long misses (blocked shots, lost shots) teach little; cap the correction.
  const capped = missLen > 30 ? scale(normalize(missT), 30) : missT
  let rate = tier.learnRate
  if (tier.overcorrect > 0 && rng.next() < tier.overcorrect) rate *= 1.6
  brain.aimOffset = sub(brain.aimOffset, scale(capped, rate))
  const noise = tier.turnNoise * tune('aiErrorScale')
  brain.aimOffset = add(brain.aimOffset, add(scale(tf.east, rng.gaussian() * noise), scale(tf.north, rng.gaussian() * noise)))
  const m = length(brain.aimOffset)
  if (m > 28) brain.aimOffset = scale(brain.aimOffset, 28 / m)
  brain.turns++
}
