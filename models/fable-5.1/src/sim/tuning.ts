/**
 * TuningRegistry: every tunable number in one place, with a classification that
 * says when a change takes effect. Values are read at the moment they are used,
 * so 'live' values apply on the next frame, 'next-shot' values on the next fired
 * shot, and the rest need a regenerate / new match.
 */
export type TuningEffect = 'live' | 'next-shot' | 'regenerate' | 'new-match'

export type TuningDef = {
  label: string
  value: number
  min: number
  max: number
  step: number
  effect: TuningEffect
  group: string
}

const def = (label: string, value: number, min: number, max: number, step: number, effect: TuningEffect, group: string): TuningDef =>
  ({ label, value, min, max, step, effect, group })

export const TUNING = {
  // Physics
  gravityScale: def('Gravity scale', 1, 0.2, 3, 0.05, 'live', 'Physics'),
  windScale: def('Wind scale', 1, 0, 4, 0.1, 'live', 'Physics'),
  minSpeedFrac: def('Min speed (×orbital)', 0.3, 0.05, 1.5, 0.01, 'next-shot', 'Physics'),
  maxSpeedFrac: def('Max speed (×orbital)', 1.1, 0.1, 2, 0.01, 'next-shot', 'Physics'),
  shotVariance: def('Shot variance', 0.05, 0, 0.3, 0.005, 'next-shot', 'Physics'),
  simDt: def('Sim step (s)', 1 / 60, 1 / 240, 1 / 20, 1 / 240, 'next-shot', 'Physics'),
  maxFlightTime: def('Max flight time (s)', 60, 5, 180, 1, 'next-shot', 'Physics'),
  chargeTime: def('Charge time (s)', 1.6, 0.4, 5, 0.1, 'live', 'Physics'),
  // Damage
  maxHealth: def('Max health', 400, 50, 2000, 10, 'new-match', 'Damage'),
  maxDamage: def('Max blast damage', 200, 10, 1000, 10, 'next-shot', 'Damage'),
  blastRadius: def('Blast radius', 7, 1, 30, 0.5, 'next-shot', 'Damage'),
  tankHitRadius: def('Tank hit radius', 1.6, 0.5, 5, 0.1, 'next-shot', 'Damage'),
  // Craters
  craterRadius: def('Crater radius', 5, 1, 20, 0.5, 'next-shot', 'Craters'),
  craterDepth: def('Crater depth', 2.2, 0.2, 10, 0.1, 'next-shot', 'Craters'),
  footprintRadius: def('Tank footprint radius', 2.4, 0.5, 8, 0.1, 'next-shot', 'Craters'),
  // Guide
  guideFraction: def('Guide fraction of arc', 0.25, 0.05, 1, 0.05, 'live', 'Guide'),
  guideOpacity: def('Guide opacity', 0.45, 0.05, 1, 0.05, 'live', 'Guide'),
  defaultPower: def('First-shot default power', 0.55, 0, 1, 0.05, 'new-match', 'Guide'),
  // Generation
  terrainAmplitude: def('Terrain amplitude (×R)', 1, 0.2, 3, 0.05, 'regenerate', 'Generation'),
  terrainScale: def('Terrain feature scale', 1, 0.3, 3, 0.05, 'regenerate', 'Generation'),
  meshColumns: def('Mesh columns', 1024, 128, 2048, 128, 'regenerate', 'Generation'),
  radiusMin: def('Planet radius min', 70, 30, 200, 5, 'new-match', 'Generation'),
  radiusMax: def('Planet radius max', 100, 30, 250, 5, 'new-match', 'Generation'),
  // AI
  aiThinkTime: def('AI think time (s)', 1.8, 0, 6, 0.1, 'next-shot', 'AI'),
  aiSearchBudget: def('AI search budget', 900, 50, 5000, 50, 'next-shot', 'AI'),
  aiErrorScale: def('AI error scale', 1, 0, 3, 0.05, 'next-shot', 'AI'),
} satisfies Record<string, TuningDef>

export type TuningKey = keyof typeof TUNING

type Listener = () => void
const listeners = new Set<Listener>()
let version = 0
export const getTuningVersion = () => version

/** Read a tunable value at use time. */
export const tune = (key: TuningKey): number => TUNING[key].value

export function setTuning(key: TuningKey, value: number) {
  const d = TUNING[key]
  d.value = Math.min(d.max, Math.max(d.min, value))
  version++
  listeners.forEach((l) => l())
}

export function subscribeTuning(l: Listener) {
  listeners.add(l)
  return () => { listeners.delete(l) }
}

export const tuningGroups = (): string[] => Array.from(new Set(Object.values(TUNING).map((d) => d.group)))
