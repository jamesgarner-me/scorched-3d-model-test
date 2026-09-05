export type PresetId = 'earth' | 'mars'

export type Preset = {
  id: PresetId
  name: string
  tagline: string
  gravity: number // units/s², constant magnitude toward planet centre
  windMax: number // max wind acceleration (units/s²)
  windMin: number
  waterLevel: number // relative to planet radius (units)
  amplitude: number // terrain amplitude as fraction of radius
  continentBias: number // >0 more land
  snowLine: number // height above which snow appears (units), Infinity for none
  polarCap: number // |lat| in degrees above which ice appears
  colors: {
    sky: string
    atmosphere: string
    atmosphereStrength: number
    water: string
    cloud: string
    cloudOpacity: number
    fog: string
    ambient: string
    skyLight: string
    groundLight: string
  }
}

export const PRESETS: Record<PresetId, Preset> = {
  earth: {
    id: 'earth',
    name: 'Earth-like',
    tagline: 'Oceans, forests, snowy peaks and a stiff breeze.',
    gravity: 14,
    windMin: 0.2,
    windMax: 1.2,
    waterLevel: 0,
    amplitude: 0.075,
    continentBias: 0.05,
    snowLine: 3.4,
    polarCap: 72,
    colors: {
      sky: '#02040a',
      atmosphere: '#63a9ff',
      atmosphereStrength: 1,
      water: '#1f6fa8',
      cloud: '#ffffff',
      cloudOpacity: 0.85,
      fog: '#9fc4ee',
      ambient: '#8fa6c9',
      skyLight: '#6d8fd0',
      groundLight: '#2a2416',
    },
  },
  mars: {
    id: 'mars',
    name: 'Mars-like',
    tagline: 'Rust dunes, ancient craters, low gravity and thin dusty air.',
    gravity: 8.5,
    windMin: 0.1,
    windMax: 0.6,
    waterLevel: -9,
    amplitude: 0.085,
    continentBias: 0.6,
    snowLine: Infinity,
    polarCap: 80,
    colors: {
      sky: '#050203',
      atmosphere: '#d9884e',
      atmosphereStrength: 0.55,
      water: '#7b5a3e',
      cloud: '#d8a070',
      cloudOpacity: 0.16,
      fog: '#d9a377',
      ambient: '#d0a07a',
      skyLight: '#e0a878',
      groundLight: '#3a1a0e',
    },
  },
}
