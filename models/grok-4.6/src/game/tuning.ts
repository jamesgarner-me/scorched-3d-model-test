export const TIMINGS = ['live', 'next-shot', 'regenerate', 'new-match'] as const
export type Timing = (typeof TIMINGS)[number]

export interface TuneField {
  key: string
  label: string
  value: number
  min: number
  max: number
  step: number
  timing: Timing
  section: string
}

const INITIAL: TuneField[] = [
  { key: 'tankHp', label: 'Tank HP', value: 400, min: 100, max: 800, step: 10, timing: 'new-match', section: 'Combat' },
  { key: 'maxDamage', label: 'Max blast damage', value: 200, min: 40, max: 400, step: 5, timing: 'next-shot', section: 'Combat' },
  { key: 'blastRadius', label: 'Blast radius', value: 8.5, min: 2, max: 20, step: 0.1, timing: 'next-shot', section: 'Combat' },
  { key: 'craterRadius', label: 'Crater radius', value: 6.2, min: 1, max: 16, step: 0.1, timing: 'next-shot', section: 'Combat' },
  { key: 'craterDepth', label: 'Crater depth', value: 2.4, min: 0.2, max: 8, step: 0.1, timing: 'next-shot', section: 'Combat' },
  { key: 'tankFootprint', label: 'Tank footprint', value: 2.4, min: 0.5, max: 6, step: 0.1, timing: 'next-shot', section: 'Combat' },
  { key: 'shotVariance', label: 'Shot variance', value: 0.05, min: 0, max: 0.2, step: 0.005, timing: 'next-shot', section: 'Ballistics' },
  { key: 'maxSpeed', label: 'Max muzzle speed', value: 38, min: 10, max: 70, step: 0.5, timing: 'next-shot', section: 'Ballistics' },
  { key: 'gravityEarth', label: 'Earth gravity', value: 19, min: 4, max: 40, step: 0.5, timing: 'next-shot', section: 'Ballistics' },
  { key: 'gravityMars', label: 'Mars gravity', value: 8.2, min: 2, max: 24, step: 0.2, timing: 'next-shot', section: 'Ballistics' },
  { key: 'windEarth', label: 'Earth wind scale', value: 1.8, min: 0, max: 8, step: 0.1, timing: 'new-match', section: 'Ballistics' },
  { key: 'windMars', label: 'Mars wind scale', value: 3.4, min: 0, max: 10, step: 0.1, timing: 'new-match', section: 'Ballistics' },
  { key: 'guideFraction', label: 'Guide fraction', value: 0.25, min: 0.05, max: 0.6, step: 0.01, timing: 'live', section: 'Aiming' },
  { key: 'guideOpacity', label: 'Guide opacity', value: 0.45, min: 0.05, max: 1, step: 0.01, timing: 'live', section: 'Aiming' },
  { key: 'aimYawSpeed', label: 'Bearing speed (deg/s)', value: 42, min: 8, max: 120, step: 1, timing: 'live', section: 'Aiming' },
  { key: 'aimPitchSpeed', label: 'Elevation speed (deg/s)', value: 28, min: 6, max: 90, step: 1, timing: 'live', section: 'Aiming' },
  { key: 'chargePeriod', label: 'Charge period (s)', value: 1.7, min: 0.6, max: 4, step: 0.05, timing: 'live', section: 'Aiming' },
  { key: 'defaultPower', label: 'Default power', value: 0.55, min: 0.15, max: 1, step: 0.01, timing: 'new-match', section: 'Aiming' },
  { key: 'minElevation', label: 'Min elevation (deg)', value: 6, min: 0, max: 40, step: 1, timing: 'live', section: 'Aiming' },
  { key: 'maxElevation', label: 'Max elevation (deg)', value: 82, min: 40, max: 89, step: 1, timing: 'live', section: 'Aiming' },
  { key: 'radiusMin', label: 'Planet radius min', value: 46, min: 28, max: 70, step: 1, timing: 'new-match', section: 'Planet' },
  { key: 'radiusMax', label: 'Planet radius max', value: 68, min: 40, max: 90, step: 1, timing: 'new-match', section: 'Planet' },
  { key: 'heightAmp', label: 'Height amplitude', value: 0.11, min: 0.02, max: 0.28, step: 0.005, timing: 'regenerate', section: 'Planet' },
  { key: 'seaLevelBias', label: 'Sea level bias', value: 0.02, min: -0.08, max: 0.12, step: 0.005, timing: 'regenerate', section: 'Planet' },
  { key: 'noiseFreq', label: 'Noise frequency', value: 1.15, min: 0.3, max: 3, step: 0.05, timing: 'regenerate', section: 'Planet' },
]

type Listener = () => void

export class TuningRegistry {
  private fields: Map<string, TuneField>
  private listeners = new Set<Listener>()

  constructor(fields: TuneField[] = INITIAL) {
    this.fields = new Map(fields.map((f) => [f.key, { ...f }]))
  }

  get(key: string): number {
    const field = this.fields.get(key)
    if (!field) throw new Error(`Unknown tune key: ${key}`)
    return field.value
  }

  set(key: string, value: number): void {
    const field = this.fields.get(key)
    if (!field) throw new Error(`Unknown tune key: ${key}`)
    field.value = Math.min(field.max, Math.max(field.min, value))
    this.emit()
  }

  all(): TuneField[] {
    return [...this.fields.values()].map((f) => ({ ...f }))
  }

  sections(): string[] {
    return [...new Set(this.all().map((f) => f.section))]
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn)
    return () => {
      this.listeners.delete(fn)
    }
  }

  private emit(): void {
    for (const fn of this.listeners) fn()
  }
}

export const tuning = new TuningRegistry()
