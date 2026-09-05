/**
 * Every tunable number lives here so the debug panel can list it, classify when a
 * change takes effect, and mutate it live. Gameplay code reads `tuning.<key>` at
 * use time — never captures it — so `live` edits really are live.
 */
export type TuningScope = 'live' | 'next-shot' | 'regenerate' | 'new-match';

export interface TuningMeta {
  key: TuningKey;
  label: string;
  section: string;
  scope: TuningScope;
  min: number;
  max: number;
  step: number;
}

const DEFS = {
  // --- Planet generation -------------------------------------------------
  gridResolution: { label: 'Grid resolution', section: 'Planet', scope: 'regenerate', min: 64, max: 192, step: 8, value: 144 },
  terrainAmplitude: { label: 'Terrain amplitude', section: 'Planet', scope: 'regenerate', min: 0.01, max: 0.12, step: 0.005, value: 0.05 },
  mountainStrength: { label: 'Mountain strength', section: 'Planet', scope: 'regenerate', min: 0, max: 1.5, step: 0.05, value: 0.75 },
  continentFrequency: { label: 'Continent frequency', section: 'Planet', scope: 'regenerate', min: 0.4, max: 3, step: 0.05, value: 1.15 },

  // --- Ballistics --------------------------------------------------------
  muzzleSpeed: { label: 'Max muzzle speed', section: 'Ballistics', scope: 'next-shot', min: 10, max: 90, step: 1, value: 34 },
  minPowerFraction: { label: 'Min power fraction', section: 'Ballistics', scope: 'next-shot', min: 0.05, max: 0.8, step: 0.05, value: 0.22 },
  shotVariance: { label: 'Shot variance', section: 'Ballistics', scope: 'next-shot', min: 0, max: 0.2, step: 0.005, value: 0.05 },
  simStep: { label: 'Sim timestep', section: 'Ballistics', scope: 'next-shot', min: 0.004, max: 0.033, step: 0.001, value: 1 / 90 },
  maxFlightTime: { label: 'Max flight time', section: 'Ballistics', scope: 'next-shot', min: 8, max: 90, step: 1, value: 40 },
  chargeRate: { label: 'Charge rate (%/s)', section: 'Ballistics', scope: 'live', min: 20, max: 300, step: 5, value: 78 },
  aimRate: { label: 'Aim rate (deg/s)', section: 'Ballistics', scope: 'live', min: 5, max: 120, step: 1, value: 34 },
  guideFraction: { label: 'Guide fraction of arc', section: 'Ballistics', scope: 'live', min: 0.05, max: 0.6, step: 0.01, value: 0.25 },
  guideOpacity: { label: 'Guide opacity', section: 'Ballistics', scope: 'live', min: 0.1, max: 1, step: 0.05, value: 0.45 },

  // --- Damage & craters --------------------------------------------------
  maxHealth: { label: 'Max health', section: 'Combat', scope: 'new-match', min: 100, max: 1000, step: 25, value: 400 },
  maxDamage: { label: 'Max blast damage', section: 'Combat', scope: 'next-shot', min: 40, max: 400, step: 5, value: 200 },
  blastRadius: { label: 'Blast radius', section: 'Combat', scope: 'next-shot', min: 2, max: 24, step: 0.5, value: 11 },
  blastFalloff: { label: 'Blast falloff exponent', section: 'Combat', scope: 'next-shot', min: 0.5, max: 4, step: 0.1, value: 1.6 },
  splashDamageScale: { label: 'Water splash damage', section: 'Combat', scope: 'next-shot', min: 0, max: 1, step: 0.05, value: 0.55 },
  craterRadiusScale: { label: 'Crater radius x blast', section: 'Combat', scope: 'next-shot', min: 0.3, max: 2, step: 0.05, value: 0.85 },
  craterDepthScale: { label: 'Crater depth x radius', section: 'Combat', scope: 'next-shot', min: 0.05, max: 0.8, step: 0.01, value: 0.22 },
  tankFootprint: { label: 'Tank footprint radius', section: 'Combat', scope: 'next-shot', min: 1, max: 8, step: 0.25, value: 2.75 },
  tankHitRadius: { label: 'Direct-hit radius', section: 'Combat', scope: 'next-shot', min: 0.5, max: 6, step: 0.25, value: 1.9 },

  // --- Presentation ------------------------------------------------------
  flightTimeScale: { label: 'Flight playback speed', section: 'Presentation', scope: 'live', min: 0.25, max: 3, step: 0.05, value: 1.15 },
  cameraDamping: { label: 'Camera damping', section: 'Presentation', scope: 'live', min: 0.02, max: 1, step: 0.02, value: 0.12 },
  aiThinkTime: { label: 'AI think time (s)', section: 'Presentation', scope: 'live', min: 0.2, max: 5, step: 0.1, value: 1.3 },
} as const satisfies Record<string, Omit<TuningMeta, 'key'> & { value: number }>;

export type TuningKey = keyof typeof DEFS;

export type Tuning = { [K in TuningKey]: number };

export const TUNING_META: TuningMeta[] = (Object.keys(DEFS) as TuningKey[]).map((key) => ({
  key,
  label: DEFS[key].label,
  section: DEFS[key].section,
  scope: DEFS[key].scope as TuningScope,
  min: DEFS[key].min,
  max: DEFS[key].max,
  step: DEFS[key].step,
}));

function defaults(): Tuning {
  const out = {} as Tuning;
  for (const key of Object.keys(DEFS) as TuningKey[]) out[key] = DEFS[key].value;
  return out;
}

/** The live, mutable tuning surface shared by every system. */
export const tuning: Tuning = defaults();

export function setTuning(key: TuningKey, value: number): void {
  tuning[key] = value;
}

export function resetTuning(): void {
  Object.assign(tuning, defaults());
}
