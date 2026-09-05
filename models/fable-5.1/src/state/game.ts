import { setMuted, sfx } from '../audio/sound'
import { Match, type MatchSettings } from '../sim/match'
import type { ShotParams, TankId, Trajectory } from '../sim/physics'
import { generatePlanet, type Planet } from '../sim/planet'
import { PRESETS } from '../sim/presets'
import { createRng, randomSeed } from '../sim/rng'
import { tune } from '../sim/tuning'
import { DEG, clamp, normalize, type V3 } from '../sim/vec'
import { store, type Effect, type Message, type Settings } from './store'

type Timer = { at: number; fn: () => void; token: number }

/**
 * Game flow controller. Everything time-based runs off `update(dt)` which the
 * render loop calls each frame, so pausing simply stops the clock.
 */
class Game {
  private timers: Timer[] = []
  private token = 0
  private nextId = 1
  private held = { left: false, right: false, up: false, down: false }
  private holdTime = 0
  private chargeT = 0
  private lastChargeTick = -1

  // ---- lifecycle --------------------------------------------------------

  async startMatch(settings: Settings, seed = randomSeed()) {
    this.cancelTimers()
    setMuted(!settings.sound)
    store.set({ phase: 'loading', paused: false, seed, settings, loading: { progress: 0, label: 'Preparing' }, shot: null, effects: [], message: null, winner: null, shotsFired: 0, charging: false, shake: 0, match: null })
    const preset = PRESETS[settings.preset]
    const rng = createRng(seed + ':world')
    const radius = Math.round(rng.range(tune('radiusMin'), tune('radiusMax')))
    const t0 = performance.now()
    let planet: Planet
    try {
      planet = await generatePlanet(
        { seed, preset, radius, columns: tune('meshColumns'), amplitudeScale: tune('terrainAmplitude'), featureScale: tune('terrainScale') },
        (progress, label) => store.set({ loading: { progress, label } }),
      )
    } catch (err) {
      console.error(err)
      store.set({ phase: 'menu' })
      return
    }
    const genMs = performance.now() - t0
    const matchSettings: MatchSettings = { preset: settings.preset, difficulty: settings.difficulty, seed }
    const match = new Match(planet, matchSettings)
    const s = store.get()
    store.set({
      match,
      matchId: s.matchId + 1,
      planetVersion: planet.version,
      turn: 'player',
      aim: { bearing: match.tanks.player.bearing, elevation: match.tanks.player.elevation, power: match.lastPlayerPower },
      aiAim: { bearing: match.tanks.ai.bearing, elevation: match.tanks.ai.elevation, power: 0.5 },
      health: { player: match.tanks.player.health, ai: match.tanks.ai.health },
      maxHealth: tune('maxHealth'),
      metrics: { ...s.metrics, genMs },
      phase: 'flyover',
      camera: { mode: 'flyover', focus: 'player', impact: null, version: s.camera.version + 1 },
    })
    // The flyover ends itself, or the player skips it.
    this.after(7.5, () => this.beginPlay())
  }

  /** Regenerate the current planet with the current seed and tuning (debug). */
  regenerate(seed?: string) {
    const s = store.get()
    void this.startMatch(s.settings, seed ?? s.seed)
  }

  newMatch() {
    void this.startMatch(store.get().settings)
  }

  toMenu() {
    this.cancelTimers()
    sfx.flightStop()
    store.set({ phase: 'menu', paused: false, shot: null, effects: [], message: null })
  }

  skipFlyover() {
    if (store.get().phase !== 'flyover') return
    this.cancelTimers()
    this.beginPlay()
  }

  private beginPlay() {
    store.set((s) => ({ phase: 'aim', turn: 'player', camera: { mode: 'free', focus: 'player', impact: null, version: s.camera.version + 1 } }))
    this.toast({ text: 'Your turn', sub: 'Arrow keys to aim · hold Space to charge, release to fire', tone: 'info' }, 4)
  }

  togglePause() {
    const s = store.get()
    if (s.phase === 'menu' || s.phase === 'loading') return
    store.set({ paused: !s.paused })
    sfx.ui()
  }

  setSettings(patch: Partial<Settings>) {
    const settings = { ...store.get().settings, ...patch }
    store.set({ settings })
    if (patch.sound !== undefined) setMuted(!patch.sound)
  }

  toggleDebug() {
    store.set((s) => ({ debugOpen: !s.debugOpen }))
  }

  // ---- input ------------------------------------------------------------

  setHeld(key: keyof Game['held'], down: boolean) {
    this.held[key] = down
    if (!down && !this.held.left && !this.held.right && !this.held.up && !this.held.down) this.holdTime = 0
  }

  beginCharge() {
    const s = store.get()
    if (s.phase !== 'aim' || s.paused || s.charging) return
    this.chargeT = 0
    this.lastChargeTick = -1
    store.set({ charging: true, aim: { ...s.aim, power: 0 } })
  }

  releaseFire() {
    const s = store.get()
    if (!s.charging || s.phase !== 'aim') return
    const power = clamp(s.aim.power, 0.02, 1)
    store.set({ charging: false })
    this.fire('player', { bearing: s.aim.bearing, elevation: s.aim.elevation, power })
  }

  // ---- per-frame --------------------------------------------------------

  update(dt: number) {
    const s = store.get()
    if (s.paused) return
    const time = s.time + dt
    // Aim adjustments while the player's turn is live.
    if (s.phase === 'aim') {
      const h = this.held
      const anyHeld = h.left || h.right || h.up || h.down
      if (anyHeld) {
        this.holdTime += dt
        const accel = 1 + Math.min(2, this.holdTime * 1.2)
        const bRate = 40 * DEG * accel, eRate = 25 * DEG * accel
        let { bearing, elevation } = s.aim
        if (h.left) bearing -= bRate * dt
        if (h.right) bearing += bRate * dt
        if (h.up) elevation += eRate * dt
        if (h.down) elevation -= eRate * dt
        elevation = clamp(elevation, 3 * DEG, 88 * DEG)
        let power = s.aim.power
        if (s.charging) power = this.chargePower(dt)
        store.set({ aim: { bearing, elevation, power }, time })
        if (s.match) { s.match.tanks.player.bearing = bearing; s.match.tanks.player.elevation = elevation }
      } else if (s.charging) {
        store.set({ aim: { ...s.aim, power: this.chargePower(dt) }, time })
      } else {
        store.set({ time })
      }
    } else {
      store.set({ time })
    }
    // Timers.
    const due = this.timers.filter((t) => t.at <= time)
    if (due.length) {
      this.timers = this.timers.filter((t) => t.at > time)
      due.forEach((t) => t.fn())
    }
    // Expire effects.
    const st = store.get()
    if (st.effects.some((e) => time - e.startedAt > e.life)) {
      store.set({ effects: st.effects.filter((e) => time - e.startedAt <= e.life) })
    }
  }

  private chargePower(dt: number): number {
    this.chargeT += dt
    const p = clamp(this.chargeT / tune('chargeTime'), 0, 1)
    const tick = Math.floor(p * 10)
    if (tick !== this.lastChargeTick) { this.lastChargeTick = tick; sfx.chargeTick(p) }
    return p
  }

  // ---- shots ------------------------------------------------------------

  private fire(shooter: TankId, params: ShotParams) {
    const s = store.get()
    const match = s.match
    if (!match) return
    const { trajectory, params: actual } = match.fire(shooter, params)
    const timeScale = Math.max(1, trajectory.flightTime / 6.5)
    const shot = { id: this.nextId++, shooter, params: actual, trajectory, startedAt: s.time, timeScale }
    sfx.fire()
    sfx.flightStart()
    store.set((st) => ({
      shot,
      message: null,
      phase: 'flight',
      shotsFired: match.shotsFired,
      aim: shooter === 'player' ? { ...st.aim, power: params.power } : st.aim,
      camera: { mode: 'follow', focus: shooter, impact: null, version: st.camera.version + 1 },
    }))
    this.after(trajectory.flightTime / timeScale, () => this.land(shot.id, shooter, actual, trajectory))
  }

  private land(shotId: number, shooter: TankId, params: ShotParams, trajectory: Trajectory) {
    const s = store.get()
    const match = s.match
    if (!match || s.shot?.id !== shotId) return
    sfx.flightStop()
    const t0 = performance.now()
    const res = match.resolve(shooter, params, trajectory)
    const carveMs = performance.now() - t0
    const up = normalize(trajectory.impact)
    const effects: Effect[] = [...s.effects]
    const victimOf = (id: TankId) => (id === 'player' ? 'You' : 'Enemy')
    let message: Message
    if (trajectory.outcome === 'lost') {
      message = { id: this.nextId++, text: 'Lost to space', sub: 'The shell never came down', tone: 'miss' }
      effects.push(this.effect('lost', trajectory.impact, up, 1))
    } else {
      effects.push(this.effect(res.splash ? 'splash' : 'blast', trajectory.impact, up, 2.2))
      res.splash ? sfx.splash() : sfx.impact()
      const hits = (['player', 'ai'] as TankId[]).filter((id) => res.damage[id] > 0)
      if (hits.length === 0) {
        message = { id: this.nextId++, text: res.splash ? 'Splash' : 'Miss', sub: this.missDistance(match, shooter, trajectory.impact), tone: 'miss' }
      } else {
        const parts = hits.map((id) => `${victimOf(id)} −${res.damage[id]}`)
        const direct = trajectory.outcome === 'tank'
        message = { id: this.nextId++, text: direct ? 'Direct hit!' : 'Hit!', sub: parts.join(' · '), tone: 'hit' }
      }
    }
    store.set((st) => ({
      shot: null,
      effects,
      message,
      health: { player: match.tanks.player.health, ai: match.tanks.ai.health },
      planetVersion: match.planet.version,
      metrics: { ...st.metrics, carveMs },
      phase: res.destroyed ? 'destroy' : 'impact',
      camera: { mode: 'linger', focus: shooter, impact: trajectory.impact, version: st.camera.version + 1 },
    }))
    if (res.destroyed) {
      const victim = match.tanks[res.destroyed]
      this.after(0.35, () => {
        sfx.destruction()
        store.set((st) => ({ effects: [...st.effects, this.effect('destroy', victim.pos, normalize(victim.pos), 6)], shake: 1, camera: { mode: 'linger', focus: null, impact: victim.pos, version: st.camera.version + 1 } }))
      })
      this.after(4.2, () => {
        store.set({ phase: 'over', winner: match.winner() })
      })
      return
    }
    this.after(1.9, () => (shooter === 'player' ? this.aiTurn() : this.playerTurn()))
    this.after(4.5, () => store.set((st) => (st.message?.id === message.id ? { message: null } : {})))
  }

  private missDistance(match: Match, shooter: TankId, impact: V3): string {
    const target = match.tanks[shooter === 'player' ? 'ai' : 'player']
    const dx = impact.x - target.pos.x, dy = impact.y - target.pos.y, dz = impact.z - target.pos.z
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz)
    return `${Math.round(d)} m from ${shooter === 'player' ? 'the enemy' : 'you'}`
  }

  private effect(kind: Effect['kind'], pos: V3, up: V3, life: number): Effect {
    return { id: this.nextId++, kind, pos, up, startedAt: store.get().time, life }
  }

  private playerTurn() {
    const match = store.get().match
    if (!match) return
    store.set((st) => ({
      phase: 'aim',
      turn: 'player',
      aim: { bearing: match.tanks.player.bearing, elevation: match.tanks.player.elevation, power: match.lastPlayerPower },
      camera: { mode: 'free', focus: 'player', impact: null, version: st.camera.version + 1 },
    }))
  }

  private aiTurn() {
    const match = store.get().match
    if (!match) return
    store.set((st) => ({ phase: 'ai-think', turn: 'ai', camera: { mode: 'free', focus: 'ai', impact: null, version: st.camera.version + 1 } }))
    this.after(tune('aiThinkTime'), () => {
      const sol = match.solveAi()
      match.tanks.ai.bearing = sol.bearing
      match.tanks.ai.elevation = sol.elevation
      store.set((st) => ({ phase: 'ai-aim', aiAim: { bearing: sol.bearing, elevation: sol.elevation, power: sol.power }, metrics: { ...st.metrics, aiMs: sol.solveMs, aiEvals: sol.evaluations } }))
      this.after(1.1, () => this.fire('ai', { bearing: sol.bearing, elevation: sol.elevation, power: sol.power }))
    })
  }

  // ---- helpers ----------------------------------------------------------

  private toast(m: Omit<Message, 'id'>, seconds: number) {
    const id = this.nextId++
    store.set({ message: { ...m, id } })
    this.after(seconds, () => store.set((st) => (st.message?.id === id ? { message: null } : {})))
  }

  private after(seconds: number, fn: () => void) {
    this.timers.push({ at: store.get().time + seconds, fn, token: this.token })
  }

  private cancelTimers() {
    this.token++
    this.timers = []
  }
}

export const game = new Game()
