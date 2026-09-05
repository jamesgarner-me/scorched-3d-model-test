import { aiObserve, aiSolve, createAiBrain, type AiBrain, type AiSolution, type Difficulty } from './ai'
import { blastDamage } from './damage'
import type { Planet } from './planet'
import { simulateShot, speedForPower, type ShotParams, type TankBody, type TankId, type Trajectory } from './physics'
import type { PresetId } from './presets'
import { createRng, type Rng } from './rng'
import { tune } from './tuning'
import { add, aimDirection, bearingTo, DEG, dirFromLonLat, frameAt, normalize, scale, surfaceDistance, type Frame, type V3 } from './vec'

export type MatchSettings = { preset: PresetId; difficulty: Difficulty; seed: string }

export type Tank = {
  id: TankId
  pos: V3
  frame: Frame
  bearing: number
  elevation: number
  health: number
  alive: boolean
}

export const MUZZLE_OFFSET = 1.9

export type ShotResolution = {
  trajectory: Trajectory
  params: ShotParams
  shooter: TankId
  damage: Record<TankId, number>
  cratered: boolean
  splash: boolean
  destroyed: TankId | null
  carveMs: number
}

/** Headless match state: tanks, wind, AI brain and the rules that resolve a shot. */
export class Match {
  readonly rng: Rng
  readonly tanks: Record<TankId, Tank>
  readonly wind: V3
  readonly windStrength: number
  readonly ai: AiBrain
  turn: TankId = 'player'
  shotsFired = 0
  lastShooter: TankId | null = null
  lastPlayerPower: number

  constructor(readonly planet: Planet, readonly settings: MatchSettings) {
    this.rng = createRng(settings.seed + ':match')
    const preset = planet.preset
    const dir = normalize({ x: this.rng.gaussian(), y: this.rng.gaussian() * 0.4, z: this.rng.gaussian() })
    this.windStrength = this.rng.range(preset.windMin, preset.windMax)
    this.wind = scale(dir, this.windStrength)
    this.ai = createAiBrain(settings.difficulty, this.rng)
    this.lastPlayerPower = tune('defaultPower')
    const [p, a] = this.placeTanks()
    this.tanks = { player: this.makeTank('player', p, a), ai: this.makeTank('ai', a, p) }
  }

  private makeTank(id: TankId, pos: V3, facing: V3): Tank {
    const frame = frameAt(pos)
    return { id, pos, frame, bearing: bearingTo(pos, facing), elevation: 45 * DEG, health: tune('maxHealth'), alive: true }
  }

  private placeTanks(): [V3, V3] {
    const planet = this.planet
    const candidate = (): V3 | null => {
      const lon = this.rng.range(0, Math.PI * 2)
      const lat = Math.asin(this.rng.range(-0.8, 0.8))
      const d = dirFromLonLat(lon, lat)
      const p = planet.surfacePoint(d)
      const h = planet.radiusAt(p) - planet.waterRadius
      if (h < 0.4 || h > Math.min(planet.preset.snowLine - 0.5, 4)) return null
      if (planet.slopeAt(p) > 0.18) return null
      return p
    }
    let first: V3 | null = null
    for (let i = 0; i < 600 && !first; i++) first = candidate()
    if (!first) first = planet.surfacePoint({ x: 1, y: 0, z: 0 })
    let second: V3 | null = null
    let bestFallback: V3 | null = null
    let bestSep = 0
    for (let i = 0; i < 900 && !second; i++) {
      const c = candidate()
      if (!c) continue
      const sep = surfaceDistance(first, c, planet.radius) / planet.radius
      if (sep > bestSep) { bestSep = sep; bestFallback = c }
      if (sep > 40 * DEG && sep < 85 * DEG) second = c
    }
    if (!second) second = bestFallback ?? planet.surfacePoint({ x: -1, y: 0, z: 0 })
    return [this.settle(first), this.settle(second)]
  }

  /** Seat a tank slightly above the terrain so its tracks sit on the ground. */
  private settle(p: V3): V3 {
    const up = normalize(p)
    const r = this.planet.radiusAt(p)
    return scale(up, r + 0.35)
  }

  bodies(): TankBody[] {
    return [this.tanks.player, this.tanks.ai].filter((t) => t.alive).map((t) => ({ id: t.id, pos: t.pos }))
  }

  /** Simulate a shot with the given parameters (no variance): used by the guide. */
  preview(id: TankId, params: ShotParams): Trajectory {
    const tank = this.tanks[id]
    const dir = aimDirection(tank.frame, params.bearing, params.elevation)
    const origin = add(tank.pos, scale(dir, MUZZLE_OFFSET))
    return simulateShot(this.planet, this.wind, origin, scale(dir, speedForPower(this.planet, params.power)), this.bodies(), id)
  }

  /** Fire for real: apply shot variance, then simulate. */
  fire(id: TankId, intended: ShotParams): { trajectory: Trajectory; params: ShotParams } {
    const v = tune('shotVariance')
    const params: ShotParams = {
      bearing: intended.bearing + this.rng.gaussian() * v * 8 * DEG,
      elevation: intended.elevation + this.rng.gaussian() * v * 8 * DEG,
      power: Math.min(1, Math.max(0, intended.power * (1 + this.rng.gaussian() * v * 0.4))),
    }
    this.shotsFired++
    this.lastShooter = id
    if (id === 'player') this.lastPlayerPower = intended.power
    const trajectory = this.preview(id, params)
    return { trajectory, params }
  }

  /** Apply damage and carve terrain for a landed shot. */
  resolve(id: TankId, params: ShotParams, trajectory: Trajectory): ShotResolution {
    const damage: Record<TankId, number> = { player: 0, ai: 0 }
    let cratered = false
    let splash = false
    let carveMs = 0
    let destroyed: TankId | null = null
    if (trajectory.outcome !== 'lost') {
      const impact = trajectory.impact
      for (const t of Object.values(this.tanks)) {
        if (!t.alive) continue
        const dmg = blastDamage(impact, t.pos, tune('blastRadius'), tune('maxDamage'))
        damage[t.id] = dmg
        t.health = Math.max(0, t.health - dmg)
        if (t.health === 0) { t.alive = false; destroyed = destroyed ?? t.id }
      }
      const t0 = performance.now()
      const footprints = Object.values(this.tanks).map((t) => t.pos)
      cratered = this.planet.carve(impact, tune('craterRadius'), tune('craterDepth'), footprints, tune('footprintRadius'))
      carveMs = performance.now() - t0
      splash = !cratered
    }
    if (id === 'ai') aiObserve(this.ai, trajectory.impact, this.tanks.player.pos, this.rng)
    // If both die on the same shot the shooter loses (self-destruction counts against them).
    if (!this.tanks.player.alive && !this.tanks.ai.alive) destroyed = id
    return { trajectory, params, shooter: id, damage, cratered, splash, destroyed, carveMs }
  }

  solveAi(): AiSolution {
    const ai = this.tanks.ai, player = this.tanks.player
    return aiSolve({ planet: this.planet, wind: this.wind, shooter: { id: 'ai', pos: ai.pos }, muzzleOffset: MUZZLE_OFFSET, target: { id: 'player', pos: player.pos }, brain: this.ai, rng: this.rng })
  }

  winner(): TankId | null {
    const { player, ai } = this.tanks
    // Mutual destruction counts against whoever fired the shot.
    if (!player.alive && !ai.alive) return this.lastShooter === 'player' ? 'ai' : 'player'
    if (!ai.alive) return 'player'
    if (!player.alive) return 'ai'
    return null
  }
}
