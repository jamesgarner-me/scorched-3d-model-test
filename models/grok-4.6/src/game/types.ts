import type { Vec3 } from './math.ts'

export const PRESETS = ['earth', 'mars'] as const
export type PresetId = (typeof PRESETS)[number]

export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const
export type Difficulty = (typeof DIFFICULTIES)[number]

export const PHASES = [
  'menu',
  'generating',
  'flyover',
  'playerTurn',
  'charging',
  'inFlight',
  'resolving',
  'aiThinking',
  'destruction',
  'ended',
] as const
export type Phase = (typeof PHASES)[number]

export const SIDES = ['player', 'ai'] as const
export type Side = (typeof SIDES)[number]

export interface TankState {
  side: Side
  dir: Vec3
  position: Vec3
  bearing: number
  elevation: number
  health: number
  maxHealth: number
}

export interface WindState {
  vector: Vec3
  strength: number
  bearing: number
}

export interface ShotPath {
  side: Side
  path: Vec3[]
  impact: Vec3
  water: boolean
  elapsed: number
  duration: number
}

export interface DamageEvent {
  side: Side
  amount: number
  id: number
}

export interface Metrics {
  fps: number
  frameMs: number
  generationMs: number
  aiSolveMs: number
  craterMs: number
}

export interface InputState {
  left: boolean
  right: boolean
  up: boolean
  down: boolean
  space: boolean
}

export interface SimRequest {
  origin: Vec3
  velocity: Vec3
  gravity: number
  wind: Vec3
  dt: number
  maxTime: number
  sampleHeight: (dir: Vec3) => number
}

export interface SimResult {
  path: Vec3[]
  impact: Vec3 | null
  time: number
}

export interface AiMemory {
  lastImpact: Vec3 | null
  lastAim: { bearing: number; elevation: number; power: number } | null
  lastMiss: number
}

export interface EffectEvent {
  kind: 'splash' | 'explosion' | 'destruction'
  position: Vec3
  scale: number
  id: number
}
