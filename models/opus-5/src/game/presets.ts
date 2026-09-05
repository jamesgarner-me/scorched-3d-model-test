/** The two worlds. They differ in look, gravity, wind and how much water there is. */
export type PresetId = 'earth' | 'mars';

export interface Preset {
  id: PresetId;
  name: string;
  blurb: string;
  /** Planet radius is rolled inside this range every match, so curvature varies. */
  radiusRange: [number, number];
  /** Surface gravity, in world units per second squared. */
  gravity: number;
  /**
   * Multiplies muzzle speed. Small, low-gravity worlds need slower shells or the
   * whole power bar collapses into its first few percent.
   */
  muzzleScale: number;
  /** Wind acceleration range, as a fraction of surface gravity. */
  windRange: [number, number];
  /** Fraction of the surface below sea level. 0 means no ocean at all. */
  oceanFraction: number;
  /** Palette sampled by height band: deep, shallow, shore, low, mid, high, peak. */
  palette: {
    deepWater: string;
    shallowWater: string;
    shore: string;
    low: string;
    mid: string;
    high: string;
    peak: string;
    crater: string;
  };
  atmosphere: { color: string; density: number };
  clouds: { enabled: boolean; color: string; opacity: number; coverage: number };
  sky: { color: string; starIntensity: number };
  sunColor: string;
  ambient: number;
}

export const PRESETS: Record<PresetId, Preset> = {
  earth: {
    id: 'earth',
    name: 'Terra',
    blurb: 'Oceans, forests, snow caps. Heavier gravity, gustier air.',
    radiusRange: [82, 108],
    gravity: 14,
    muzzleScale: 1,
    windRange: [0.02, 0.16],
    oceanFraction: 0.42,
    palette: {
      deepWater: '#123a63',
      shallowWater: '#1f6f97',
      shore: '#c9bd8a',
      low: '#4f7c3a',
      mid: '#6b7f45',
      high: '#7a6a4f',
      peak: '#f2f4f6',
      crater: '#4a3f33',
    },
    atmosphere: { color: '#6fb3ff', density: 1 },
    clouds: { enabled: true, color: '#ffffff', opacity: 0.55, coverage: 0.46 },
    sky: { color: '#05070f', starIntensity: 1 },
    sunColor: '#fff4e0',
    ambient: 0.26,
  },
  mars: {
    id: 'mars',
    name: 'Ares',
    blurb: 'Dry rust and dust. Low gravity, long floating arcs, thin wind.',
    radiusRange: [68, 92],
    gravity: 8,
    muzzleScale: 0.72,
    windRange: [0.01, 0.09],
    oceanFraction: 0,
    palette: {
      deepWater: '#2a1a14',
      shallowWater: '#3b241a',
      shore: '#8a5236',
      low: '#a4522f',
      mid: '#b9683a',
      high: '#8d4a2c',
      peak: '#d8b49a',
      crater: '#5f2f1c',
    },
    atmosphere: { color: '#e0885a', density: 0.7 },
    clouds: { enabled: true, color: '#e9b189', opacity: 0.22, coverage: 0.34 },
    sky: { color: '#0b0705', starIntensity: 0.85 },
    sunColor: '#ffe2c0',
    ambient: 0.32,
  },
};

export const PRESET_IDS: PresetId[] = ['earth', 'mars'];
