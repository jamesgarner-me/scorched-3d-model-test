import {
  aimDirection,
  clamp,
  deg,
  dist,
  localFrame,
  rad,
  wrapAngle,
  type Vec3,
} from './math.ts'
import { createRng, randomSeed } from './rng.ts'
import { tuning } from './tuning.ts'
import {
  findLandingSites,
  generatePlanet,
  isWater,
  sampleHeight,
  surfacePoint,
  type Planet,
} from './planet.ts'
import { guidePath, simulateBallistic, SIM_DT } from './physics.ts'
import { applyAngleJitter, applyVariance, blastDamage, remainingHealth } from './combat.ts'
import { carveCrater } from './craters.ts'
import { solveAim } from './ai.ts'
import type {
  AiMemory,
  DamageEvent,
  Difficulty,
  EffectEvent,
  InputState,
  Metrics,
  Phase,
  PresetId,
  ShotPath,
  Side,
  TankState,
} from './types.ts'

export interface Snapshot {
  phase: Phase
  paused: boolean
  preset: PresetId | null
  difficulty: Difficulty
  seed: string
  progress: number
  progressLabel: string
  player: TankPublic
  enemy: TankPublic
  windStrength: number
  windBearing: number
  turn: Side
  bearing: number
  elevation: number
  power: number
  lastPower: number
  charging: boolean
  shot: ShotPath | null
  guide: Vec3[]
  lastDamage: DamageEvent | null
  winner: Side | null
  planetVersion: number
  radius: number
  seaLevel: number
  muted: boolean
  debug: boolean
  metrics: Metrics
  effect: EffectEvent | null
  flyoverT: number
  destructionT: number
}

export interface TankPublic {
  side: Side
  position: Vec3
  dir: Vec3
  bearing: number
  elevation: number
  health: number
  maxHealth: number
}

const emptyTank = (side: Side): TankPublic => ({
  side,
  position: [0, 1, 0],
  dir: [0, 1, 0],
  bearing: 0,
  elevation: rad(32),
  health: 400,
  maxHealth: 400,
})

type Listener = () => void

export class MatchEngine {
  planet: Planet | null = null
  private phase: Phase = 'menu'
  private paused = false
  private phaseBeforePause: Phase = 'menu'
  private preset: PresetId | null = null
  private difficulty: Difficulty = 'medium'
  private seed = ''
  private progress = 0
  private progressLabel = ''
  private player: TankState | null = null
  private enemy: TankState | null = null
  private lastPower = 0.55
  private power = 0.55
  private chargeT = 0
  private shot: ShotPath | null = null
  private guide: Vec3[] = []
  private lastDamage: DamageEvent | null = null
  private winner: Side | null = null
  private planetVersion = 0
  private muted = false
  private debug = false
  private metrics: Metrics = { fps: 0, frameMs: 0, generationMs: 0, aiSolveMs: 0, craterMs: 0 }
  private effect: EffectEvent | null = null
  private flyoverT = 0
  private destructionT = 0
  private resolveT = 0
  private thinkT = 0
  private aiQueued: { bearing: number; elevation: number; power: number } | null = null
  private memory: AiMemory = { lastImpact: null, lastAim: null, lastMiss: 0 }
  private turnCount = 0
  private genToken = 0
  private listeners = new Set<Listener>()
  private spaceWasDown = false
  private damageId = 1
  private effectId = 1
  private dirtyGuide = true
  private fpsAccum = 0
  private fpsFrames = 0

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn)
    return () => {
      this.listeners.delete(fn)
    }
  }

  private emit(): void {
    for (const fn of this.listeners) fn()
  }

  getSnapshot(): Snapshot {
    return {
      phase: this.paused ? this.phaseBeforePause : this.phase,
      paused: this.paused,
      preset: this.preset,
      difficulty: this.difficulty,
      seed: this.seed,
      progress: this.progress,
      progressLabel: this.progressLabel,
      player: this.publicTank(this.player, 'player'),
      enemy: this.publicTank(this.enemy, 'ai'),
      windStrength: this.planet?.wind.strength ?? 0,
      windBearing: this.planet?.wind.bearing ?? 0,
      turn: this.phase === 'aiThinking' || this.shot?.side === 'ai' ? 'ai' : 'player',
      bearing: this.player?.bearing ?? 0,
      elevation: this.player?.elevation ?? rad(32),
      power: this.power,
      lastPower: this.lastPower,
      charging: this.phase === 'charging',
      shot: this.shot,
      guide: this.guide,
      lastDamage: this.lastDamage,
      winner: this.winner,
      planetVersion: this.planetVersion,
      radius: this.planet?.baseRadius ?? 54,
      seaLevel: this.planet?.seaLevel ?? 54,
      muted: this.muted,
      debug: this.debug,
      metrics: { ...this.metrics },
      effect: this.effect,
      flyoverT: this.flyoverT,
      destructionT: this.destructionT,
    }
  }

  private publicTank(tank: TankState | null, side: Side): TankPublic {
    if (!tank) return emptyTank(side)
    return {
      side: tank.side,
      position: tank.position,
      dir: tank.dir,
      bearing: tank.bearing,
      elevation: tank.elevation,
      health: tank.health,
      maxHealth: tank.maxHealth,
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted
    this.emit()
  }

  setDebug(debug: boolean): void {
    this.debug = debug
    this.emit()
  }

  togglePause(): void {
    if (this.phase === 'menu' || this.phase === 'generating' || this.phase === 'ended') return
    if (this.paused) {
      this.paused = false
      this.phase = this.phaseBeforePause
    } else {
      this.paused = true
      this.phaseBeforePause = this.phase
    }
    this.emit()
  }

  setAimFromHud(bearingDeg: number, elevationDeg: number): void {
    if (!this.player || this.inputLocked()) return
    this.player.bearing = wrapAngle(rad(bearingDeg))
    this.player.elevation = rad(clamp(elevationDeg, tuning.get('minElevation'), tuning.get('maxElevation')))
    this.dirtyGuide = true
    this.emit()
  }

  async startMatch(preset: PresetId, difficulty: Difficulty, seed = randomSeed()): Promise<void> {
    this.preset = preset
    this.difficulty = difficulty
    this.seed = seed
    this.phase = 'generating'
    this.paused = false
    this.progress = 0
    this.progressLabel = 'Preparing survey'
    this.winner = null
    this.shot = null
    this.guide = []
    this.effect = null
    this.lastDamage = null
    this.memory = { lastImpact: null, lastAim: null, lastMiss: 0 }
    this.turnCount = 0
    this.lastPower = tuning.get('defaultPower')
    this.power = this.lastPower
    this.emit()

    const token = ++this.genToken
    const t0 = now()
    const planet = await generatePlanet({
      seed,
      preset,
      onProgress: (p, label) => {
        if (token !== this.genToken) return
        this.progress = p
        this.progressLabel = label
        this.emit()
      },
    })
    if (token !== this.genToken) return
    this.metrics.generationMs = now() - t0
    const pad = 1400 - this.metrics.generationMs
    if (pad > 0) {
      await new Promise((resolve) => setTimeout(resolve, pad))
    }
    if (token !== this.genToken) return
    this.planet = planet
    this.planetVersion += 1
    this.placeTanks()
    this.flyoverT = 0
    this.phase = 'flyover'
    this.dirtyGuide = true
    this.emit()
  }

  async newMatch(): Promise<void> {
    if (!this.preset) return
    await this.startMatch(this.preset, this.difficulty)
  }

  async regenerate(seed = this.seed): Promise<void> {
    if (!this.preset) return
    await this.startMatch(this.preset, this.difficulty, seed)
  }

  returnToMenu(): void {
    this.genToken += 1
    this.phase = 'menu'
    this.paused = false
    this.planet = null
    this.player = null
    this.enemy = null
    this.shot = null
    this.emit()
  }

  recordPerf(dt: number): void {
    this.fpsAccum += dt
    this.fpsFrames += 1
    this.metrics.frameMs = dt * 1000
    if (this.fpsAccum >= 0.4) {
      this.metrics.fps = this.fpsFrames / this.fpsAccum
      this.fpsAccum = 0
      this.fpsFrames = 0
    }
  }

  tick(dt: number, input: InputState): void {
    this.recordPerf(dt)
    if (this.paused) return

    if (this.phase === 'flyover') {
      this.flyoverT += dt
      if (this.flyoverT >= 4.2) {
        this.phase = 'playerTurn'
        this.dirtyGuide = true
      }
      this.emit()
      return
    }

    if (this.phase === 'destruction') {
      this.destructionT += dt
      if (this.destructionT >= 2.8) {
        this.phase = 'ended'
      }
      this.emit()
      return
    }

    if (this.phase === 'inFlight' && this.shot) {
      this.shot.elapsed += dt
      if (this.shot.elapsed >= this.shot.duration) {
        this.resolveImpact()
        return
      }
      this.emit()
      return
    }

    if (this.phase === 'resolving') {
      this.resolveT += dt
      if (this.resolveT >= 1.15) {
        this.afterResolve()
      }
      return
    }

    if (this.phase === 'aiThinking') {
      this.thinkT += dt
      if (!this.aiQueued && this.thinkT > 0.25) {
        this.queueAiShot()
      }
      if (this.aiQueued && this.thinkT > 0.95) {
        const aim = this.aiQueued
        this.aiQueued = null
        if (this.enemy) {
          this.enemy.bearing = aim.bearing
          this.enemy.elevation = aim.elevation
        }
        this.fire('ai', aim.bearing, aim.elevation, aim.power)
        return
      }
      this.emit()
      return
    }

    if ((this.phase === 'playerTurn' || this.phase === 'charging') && this.player) {
      this.applyAim(dt, input)
      if (this.phase === 'playerTurn' && input.space && !this.spaceWasDown) {
        this.phase = 'charging'
        this.chargeT = 0
        this.power = 0
      }
      if (this.phase === 'charging') {
        this.chargeT += dt
        const period = Math.max(0.4, tuning.get('chargePeriod'))
        const tri = this.chargeT / period
        const cycle = tri % 2
        this.power = cycle < 1 ? cycle : 2 - cycle
        this.dirtyGuide = true
        if (!input.space) {
          this.fire('player', this.player.bearing, this.player.elevation, this.power)
        }
      }
      if (this.dirtyGuide) this.rebuildGuide()
    }

    this.spaceWasDown = input.space
  }

  inputLocked(): boolean {
    return (
      this.paused ||
      this.phase === 'inFlight' ||
      this.phase === 'resolving' ||
      this.phase === 'destruction' ||
      this.phase === 'ended' ||
      this.phase === 'generating' ||
      this.phase === 'flyover' ||
      this.phase === 'aiThinking'
    )
  }

  cameraFree(): boolean {
    return (
      !this.paused &&
      (this.phase === 'playerTurn' ||
        this.phase === 'charging' ||
        this.phase === 'aiThinking' ||
        this.phase === 'resolving')
    )
  }

  private applyAim(dt: number, input: InputState): void {
    if (!this.player) return
    const yaw = rad(tuning.get('aimYawSpeed')) * dt
    const pitch = rad(tuning.get('aimPitchSpeed')) * dt
    let changed = false
    if (input.left) {
      this.player.bearing = wrapAngle(this.player.bearing - yaw)
      changed = true
    }
    if (input.right) {
      this.player.bearing = wrapAngle(this.player.bearing + yaw)
      changed = true
    }
    if (input.up) {
      this.player.elevation = clamp(
        this.player.elevation + pitch,
        rad(tuning.get('minElevation')),
        rad(tuning.get('maxElevation')),
      )
      changed = true
    }
    if (input.down) {
      this.player.elevation = clamp(
        this.player.elevation - pitch,
        rad(tuning.get('minElevation')),
        rad(tuning.get('maxElevation')),
      )
      changed = true
    }
    if (changed) {
      this.dirtyGuide = true
      this.emit()
    }
  }

  private placeTanks(): void {
    if (!this.planet) return
    const sites = findLandingSites(this.planet, this.seed)
    const hp = tuning.get('tankHp')
    this.player = {
      side: 'player',
      dir: sites.player,
      position: surfacePoint(this.planet, sites.player),
      bearing: 0,
      elevation: rad(32),
      health: hp,
      maxHealth: hp,
    }
    this.enemy = {
      side: 'ai',
      dir: sites.enemy,
      position: surfacePoint(this.planet, sites.enemy),
      bearing: 0,
      elevation: rad(32),
      health: hp,
      maxHealth: hp,
    }
    this.player.bearing = this.bearingToward(this.player, this.enemy)
    this.enemy.bearing = this.bearingToward(this.enemy, this.player)
  }

  private bearingToward(from: TankState, to: TankState): number {
    const frame = localFrame(from.position)
    const toward = [
      to.position[0] - from.position[0],
      to.position[1] - from.position[1],
      to.position[2] - from.position[2],
    ] as Vec3
    const flat = [
      toward[0] - frame.up[0] * (toward[0] * frame.up[0] + toward[1] * frame.up[1] + toward[2] * frame.up[2]),
      toward[1] - frame.up[1] * (toward[0] * frame.up[0] + toward[1] * frame.up[1] + toward[2] * frame.up[2]),
      toward[2] - frame.up[2] * (toward[0] * frame.up[0] + toward[1] * frame.up[1] + toward[2] * frame.up[2]),
    ] as Vec3
    return Math.atan2(
      flat[0] * frame.east[0] + flat[1] * frame.east[1] + flat[2] * frame.east[2],
      flat[0] * frame.north[0] + flat[1] * frame.north[1] + flat[2] * frame.north[2],
    )
  }

  private muzzle(tank: TankState): { origin: Vec3; dir: Vec3 } {
    const frame = localFrame(tank.position)
    const dir = aimDirection(frame, tank.bearing, tank.elevation)
    const origin: Vec3 = [
      tank.position[0] + dir[0] * 1.65 + frame.up[0] * 0.42,
      tank.position[1] + dir[1] * 1.65 + frame.up[1] * 0.42,
      tank.position[2] + dir[2] * 1.65 + frame.up[2] * 0.42,
    ]
    return { origin, dir }
  }

  private shotContext() {
    return {
      gravity: this.planet
        ? this.planet.preset === 'earth'
          ? tuning.get('gravityEarth')
          : tuning.get('gravityMars')
        : 18,
      wind: this.planet?.wind.vector ?? ([0, 0, 0] as Vec3),
      maxSpeed: tuning.get('maxSpeed'),
      variance: tuning.get('shotVariance'),
      blastRadius: tuning.get('blastRadius'),
      maxDamage: tuning.get('maxDamage'),
      craterRadius: tuning.get('craterRadius'),
      craterDepth: tuning.get('craterDepth'),
      footprint: tuning.get('tankFootprint'),
    }
  }

  private simulateFor(origin: Vec3, velocity: Vec3) {
    if (!this.planet) {
      return { path: [origin], impact: origin, time: 0 }
    }
    const ctx = this.shotContext()
    return simulateBallistic({
      origin,
      velocity,
      gravity: ctx.gravity,
      wind: ctx.wind,
      dt: SIM_DT,
      maxTime: 16,
      sampleHeight: (d) => sampleHeight(this.planet!, d),
    })
  }

  private rebuildGuide(): void {
    if (!this.planet || !this.player) return
    const ctx = this.shotContext()
    const power = this.phase === 'charging' ? this.power : this.lastPower
    const { origin, dir } = this.muzzle(this.player)
    const speed = power * ctx.maxSpeed
    const result = this.simulateFor(origin, [dir[0] * speed, dir[1] * speed, dir[2] * speed])
    this.guide = guidePath(result, tuning.get('guideFraction'))
    this.dirtyGuide = false
    this.emit()
  }

  private fire(side: Side, bearing: number, elevation: number, power: number): void {
    const tank = side === 'player' ? this.player : this.enemy
    if (!tank || !this.planet) return
    tank.bearing = bearing
    tank.elevation = elevation
    const rng = createRng(`${this.seed}:shot:${this.turnCount}:${side}`)
    const ctx = this.shotContext()
    const jitteredBearing = applyAngleJitter(bearing, ctx.variance, rng)
    const jitteredElevation = applyAngleJitter(elevation, ctx.variance * 0.7, rng)
    const jitteredPower = clamp(applyVariance(power, ctx.variance, rng), 0.05, 1)
    tank.bearing = jitteredBearing
    tank.elevation = jitteredElevation
    const { origin, dir } = this.muzzle(tank)
    tank.bearing = bearing
    tank.elevation = elevation
    const speed = jitteredPower * ctx.maxSpeed
    const result = this.simulateFor(origin, [dir[0] * speed, dir[1] * speed, dir[2] * speed])
    const impact = result.impact ?? result.path[result.path.length - 1]!
    this.shot = {
      side,
      path: result.path,
      impact,
      water: isWater(this.planet, impact),
      elapsed: 0,
      duration: Math.max(0.35, result.time),
    }
    if (side === 'player') this.lastPower = power
    this.phase = 'inFlight'
    this.turnCount += 1
    this.emit()
  }

  private resolveImpact(): void {
    if (!this.shot || !this.planet || !this.player || !this.enemy) return
    const ctx = this.shotContext()
    const impact = this.shot.impact
    if (!this.shot.water) {
      const t0 = now()
      carveCrater(
        this.planet,
        impact,
        ctx.craterRadius,
        ctx.craterDepth,
        [this.player.dir, this.enemy.dir],
        ctx.footprint,
      )
      this.player.position = surfacePoint(this.planet, this.player.dir)
      this.enemy.position = surfacePoint(this.planet, this.enemy.dir)
      this.metrics.craterMs = now() - t0
      this.planetVersion += 1
    }
    this.effect = {
      kind: this.shot.water ? 'splash' : 'explosion',
      position: impact,
      scale: this.shot.water ? 1 : 1.15,
      id: this.effectId++,
    }

    let reported: DamageEvent | null = null
    for (const tank of [this.player, this.enemy]) {
      const amount = blastDamage(dist(tank.position, impact), ctx.maxDamage, ctx.blastRadius)
      if (amount > 0.5) {
        tank.health = remainingHealth(tank.health, amount)
        reported = { side: tank.side, amount: Math.round(amount), id: this.damageId++ }
      }
    }
    this.lastDamage = reported
    if (this.shot.side === 'ai') {
      this.memory.lastImpact = impact
      this.memory.lastMiss = dist(impact, this.player.position)
    }
    this.phase = 'resolving'
    this.resolveT = 0
    this.emit()
  }

  private afterResolve(): void {
    if (!this.player || !this.enemy) return
    const dead: Side | null =
      this.player.health <= 0 ? 'player' : this.enemy.health <= 0 ? 'ai' : null
    if (dead) {
      this.winner = dead === 'player' ? 'ai' : 'player'
      const wreck = dead === 'player' ? this.player : this.enemy
      this.effect = {
        kind: 'destruction',
        position: wreck.position,
        scale: 2.2,
        id: this.effectId++,
      }
      this.phase = 'destruction'
      this.destructionT = 0
      this.emit()
      return
    }
    if (this.shot?.side === 'player') {
      this.phase = 'aiThinking'
      this.thinkT = 0
      this.aiQueued = null
    } else {
      this.phase = 'playerTurn'
      this.dirtyGuide = true
    }
    this.shot = null
    this.emit()
  }

  private queueAiShot(): void {
    if (!this.planet || !this.player || !this.enemy) return
    const ctx = this.shotContext()
    const solution = solveAim({
      planet: this.planet,
      from: this.enemy.position,
      target: this.player.position,
      difficulty: this.difficulty,
      memory: this.memory,
      seed: this.seed,
      turn: this.turnCount,
      gravity: ctx.gravity,
      wind: ctx.wind,
      maxSpeed: ctx.maxSpeed,
      minElevation: tuning.get('minElevation'),
      maxElevation: tuning.get('maxElevation'),
    })
    this.metrics.aiSolveMs = solution.solveMs
    this.memory.lastAim = {
      bearing: solution.bearing,
      elevation: solution.elevation,
      power: solution.power,
    }
    this.aiQueued = solution
    this.emit()
  }
}

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}

export function formatDeg(value: number): string {
  return `${deg(value).toFixed(1)}°`
}
