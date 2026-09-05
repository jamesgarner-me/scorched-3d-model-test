import { useSyncExternalStore } from 'react'
import type { Difficulty } from '../sim/ai'
import type { Match } from '../sim/match'
import type { ShotParams, TankId, Trajectory } from '../sim/physics'
import type { PresetId } from '../sim/presets'
import type { V3 } from '../sim/vec'

export type Phase =
  | 'menu'
  | 'loading'
  | 'flyover'
  | 'aim' // player aiming / charging
  | 'flight' // a shot is in the air
  | 'impact' // linger on the impact
  | 'ai-think'
  | 'ai-aim'
  | 'destroy' // destruction sequence
  | 'over'

export type Settings = { preset: PresetId; difficulty: Difficulty; sound: boolean }

export type ActiveShot = {
  id: number
  shooter: TankId
  params: ShotParams
  trajectory: Trajectory
  /** Game-time when the shot left the muzzle. */
  startedAt: number
  /** Sim seconds per real second: long flights are played back faster. */
  timeScale: number
}

export type EffectKind = 'blast' | 'splash' | 'destroy' | 'lost'
export type Effect = { id: number; kind: EffectKind; pos: V3; up: V3; startedAt: number; life: number }

export type Message = { id: number; text: string; sub?: string; tone: 'hit' | 'miss' | 'info' }

export type Metrics = { fps: number; frameMs: number; genMs: number; aiMs: number; carveMs: number; aiEvals: number }

export type CameraMode = 'flyover' | 'free' | 'follow' | 'linger'

export type State = {
  phase: Phase
  paused: boolean
  settings: Settings
  seed: string
  loading: { progress: number; label: string }
  match: Match | null
  matchId: number
  planetVersion: number
  turn: TankId
  aim: ShotParams // player's aim; power = guide power (last shot or charging)
  charging: boolean
  aiAim: ShotParams
  health: Record<TankId, number>
  maxHealth: number
  shot: ActiveShot | null
  effects: Effect[]
  message: Message | null
  winner: TankId | null
  shotsFired: number
  metrics: Metrics
  debugOpen: boolean
  shake: number
  /** Camera intent set by the game flow; the rig consumes it. */
  camera: { mode: CameraMode; focus: TankId | null; impact: V3 | null; version: number }
  time: number
}

const initial: State = {
  phase: 'menu',
  paused: false,
  settings: { preset: 'earth', difficulty: 'medium', sound: true },
  seed: '',
  loading: { progress: 0, label: '' },
  match: null,
  matchId: 0,
  planetVersion: 0,
  turn: 'player',
  aim: { bearing: 0, elevation: Math.PI / 4, power: 0.55 },
  charging: false,
  aiAim: { bearing: 0, elevation: Math.PI / 4, power: 0.5 },
  health: { player: 400, ai: 400 },
  maxHealth: 400,
  shot: null,
  effects: [],
  message: null,
  winner: null,
  shotsFired: 0,
  metrics: { fps: 0, frameMs: 0, genMs: 0, aiMs: 0, carveMs: 0, aiEvals: 0 },
  debugOpen: false,
  shake: 0,
  camera: { mode: 'free', focus: null, impact: null, version: 0 },
  time: 0,
}

type Listener = () => void
let state: State = initial
const listeners = new Set<Listener>()

export const store = {
  get: () => state,
  set: (partial: Partial<State> | ((s: State) => Partial<State>)) => {
    const next = typeof partial === 'function' ? partial(state) : partial
    state = { ...state, ...next }
    listeners.forEach((l) => l())
  },
  subscribe: (l: Listener) => {
    listeners.add(l)
    return () => { listeners.delete(l) }
  },
}

/** Select a slice of state; return primitives or stable references from the selector. */
export function useStore<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(store.subscribe, () => selector(state), () => selector(state))
}
