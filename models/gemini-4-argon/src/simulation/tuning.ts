import { PlanetPresetId, TuningClassification } from './types';

export interface TuningConfig {
  // Planet Generation (regenerate)
  minPlanetRadius: number;
  maxPlanetRadius: number;
  terrainAmplitude: number;
  terrainRoughness: number;
  waterLevelOffset: number;

  // Physics & Ballistics (next-shot / live)
  gravityScale: number;
  windScale: number;
  maxMuzzleSpeed: number;
  minMuzzleSpeed: number;
  shotVariancePct: number;

  // Trajectory Guide (live)
  guideArcFraction: number;
  guideOpacity: number;
  defaultFirstShotPower: number;

  // Combat & Craters (next-shot / new-match)
  tankMaxHealth: number;
  maxBlastDamage: number;
  blastRadius: number;
  craterRadius: number;
  craterDepth: number;
  tankFootprintRadius: number;
}

export interface TuningFieldMeta {
  key: keyof TuningConfig;
  label: string;
  section:
    'Planet Generation' | 'Physics & Wind' | 'Trajectory Guide' | 'Combat & Craters';
  classification: TuningClassification;
  min: number;
  max: number;
  step: number;
  unit?: string;
}

export interface PlanetPresetDefinition {
  id: PlanetPresetId;
  name: string;
  tagline: string;
  description: string;
  gravityMultiplier: number;
  windMaxStrength: number;
  waterLevelOffset: number;
  terrainAmplitude: number;
  terrainRoughness: number;
  hasWater: boolean;
  hasClouds: boolean;
  atmosphereColor: string;
  skyTint: string;
  waterColor: string;
}

export const PLANET_PRESETS: Record<PlanetPresetId, PlanetPresetDefinition> = {
  earth: {
    id: 'earth',
    name: 'Earth-like',
    tagline: 'Temperate biosphere with oceans, alpine peaks, and shifting trade winds',
    description:
      'Standard planetary gravity (9.8 m/s²), deep oceans that splash instead of cratering, verdant valleys, and snow-capped ridges.',
    gravityMultiplier: 1.0,
    windMaxStrength: 4.2,
    waterLevelOffset: -0.35,
    terrainAmplitude: 4.8,
    terrainRoughness: 2.15,
    hasWater: true,
    hasClouds: true,
    atmosphereColor: '#4da6ff',
    skyTint: '#09152b',
    waterColor: '#1b6ca8',
  },
  mars: {
    id: 'mars',
    name: 'Mars-like',
    tagline: 'Arid rust world with lower gravity, high ridges, and dust-storm gusts',
    description:
      'Lower gravity (0.62x) lets shells sail farther across the horizon, while dry basalt basins and high iron-oxide ridges reward high-angle lob shots.',
    gravityMultiplier: 0.62,
    windMaxStrength: 5.8,
    waterLevelOffset: -10.0, // No open surface water by default on Mars
    terrainAmplitude: 5.8,
    terrainRoughness: 2.45,
    hasWater: false,
    hasClouds: false,
    atmosphereColor: '#e07a47',
    skyTint: '#24110b',
    waterColor: '#5c2c18',
  },
};

export const DEFAULT_TUNING: TuningConfig = {
  minPlanetRadius: 24,
  maxPlanetRadius: 34,
  terrainAmplitude: 4.8,
  terrainRoughness: 2.15,
  waterLevelOffset: -0.35,

  gravityScale: 18.0,
  windScale: 1.0,
  maxMuzzleSpeed: 31.0,
  minMuzzleSpeed: 9.0,
  shotVariancePct: 2.2,

  guideArcFraction: 0.25,
  guideOpacity: 0.45,
  defaultFirstShotPower: 55,

  tankMaxHealth: 400,
  maxBlastDamage: 200,
  blastRadius: 6.5,
  craterRadius: 4.8,
  craterDepth: 2.4,
  tankFootprintRadius: 2.5,
};

export const TUNING_FIELDS: ReadonlyArray<TuningFieldMeta> = [
  {
    key: 'minPlanetRadius',
    label: 'Min Planet Radius',
    section: 'Planet Generation',
    classification: 'regenerate',
    min: 18,
    max: 30,
    step: 1,
    unit: 'm',
  },
  {
    key: 'maxPlanetRadius',
    label: 'Max Planet Radius',
    section: 'Planet Generation',
    classification: 'regenerate',
    min: 26,
    max: 44,
    step: 1,
    unit: 'm',
  },
  {
    key: 'terrainAmplitude',
    label: 'Terrain Amplitude',
    section: 'Planet Generation',
    classification: 'regenerate',
    min: 1.5,
    max: 9.0,
    step: 0.2,
    unit: 'm',
  },
  {
    key: 'terrainRoughness',
    label: 'Terrain Roughness',
    section: 'Planet Generation',
    classification: 'regenerate',
    min: 1.2,
    max: 3.5,
    step: 0.05,
  },
  {
    key: 'waterLevelOffset',
    label: 'Water Level Offset',
    section: 'Planet Generation',
    classification: 'regenerate',
    min: -5.0,
    max: 2.0,
    step: 0.1,
    unit: 'm',
  },
  {
    key: 'gravityScale',
    label: 'Base Gravity Acceleration',
    section: 'Physics & Wind',
    classification: 'live',
    min: 8.0,
    max: 32.0,
    step: 0.5,
    unit: 'm/s²',
  },
  {
    key: 'windScale',
    label: 'Wind Multiplier',
    section: 'Physics & Wind',
    classification: 'live',
    min: 0.0,
    max: 3.0,
    step: 0.1,
    unit: 'x',
  },
  {
    key: 'maxMuzzleSpeed',
    label: 'Max Muzzle Velocity',
    section: 'Physics & Wind',
    classification: 'live',
    min: 18.0,
    max: 48.0,
    step: 0.5,
    unit: 'm/s',
  },
  {
    key: 'shotVariancePct',
    label: 'Shot Variance',
    section: 'Physics & Wind',
    classification: 'next-shot',
    min: 0.0,
    max: 8.0,
    step: 0.2,
    unit: '%',
  },
  {
    key: 'guideArcFraction',
    label: 'Guide Arc Length',
    section: 'Trajectory Guide',
    classification: 'live',
    min: 0.1,
    max: 0.4,
    step: 0.01,
  },
  {
    key: 'guideOpacity',
    label: 'Guide Opacity',
    section: 'Trajectory Guide',
    classification: 'live',
    min: 0.15,
    max: 0.9,
    step: 0.05,
  },
  {
    key: 'tankMaxHealth',
    label: 'Tank Max HP',
    section: 'Combat & Craters',
    classification: 'new-match',
    min: 100,
    max: 800,
    step: 50,
    unit: 'HP',
  },
  {
    key: 'maxBlastDamage',
    label: 'Max Blast Damage',
    section: 'Combat & Craters',
    classification: 'next-shot',
    min: 50,
    max: 400,
    step: 10,
    unit: 'HP',
  },
  {
    key: 'blastRadius',
    label: 'Blast Damage Radius',
    section: 'Combat & Craters',
    classification: 'next-shot',
    min: 2.5,
    max: 12.0,
    step: 0.5,
    unit: 'm',
  },
  {
    key: 'craterRadius',
    label: 'Crater Carve Radius',
    section: 'Combat & Craters',
    classification: 'next-shot',
    min: 2.0,
    max: 9.0,
    step: 0.2,
    unit: 'm',
  },
  {
    key: 'craterDepth',
    label: 'Crater Carve Depth',
    section: 'Combat & Craters',
    classification: 'next-shot',
    min: 0.8,
    max: 5.0,
    step: 0.2,
    unit: 'm',
  },
  {
    key: 'tankFootprintRadius',
    label: 'Tank Footprint Protection',
    section: 'Combat & Craters',
    classification: 'next-shot',
    min: 1.5,
    max: 5.0,
    step: 0.25,
    unit: 'm',
  },
];
