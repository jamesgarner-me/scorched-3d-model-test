import type { Preset } from './presets';
import { clamp } from './vec';

export type Rgb = [number, number, number];

const cache = new Map<string, Rgb>();

export function hexToRgb(hex: string): Rgb {
  const cached = cache.get(hex);
  if (cached) return cached;
  const n = parseInt(hex.slice(1), 16);
  const rgb: Rgb = [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  cache.set(hex, rgb);
  return rgb;
}

export function mix(a: Rgb, b: Rgb, t: number): Rgb {
  const k = clamp(t, 0, 1);
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
}

function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

export interface TerrainSample {
  height: number;
  seaLevel: number;
  minHeight: number;
  maxHeight: number;
  /** 0 = flat, 1 = vertical. */
  slope: number;
  /** Total depth carved away here by craters. */
  carved: number;
  /** |sin(latitude)| — 1 at the poles. */
  latitude: number;
}

/**
 * Height/slope/latitude banding. Earth-like worlds get shorelines, forest, rock and
 * snow; Mars-like worlds stay in rust and dust because their palette has no green
 * and their sea level sits below the deepest valley.
 */
export function terrainColor(preset: Preset, s: TerrainSample): Rgb {
  const p = preset.palette;
  let color: Rgb;

  if (s.height < s.seaLevel) {
    const depth = clamp((s.seaLevel - s.height) / Math.max(s.seaLevel - s.minHeight, 1e-4), 0, 1);
    color = mix(hexToRgb(p.shallowWater), hexToRgb(p.deepWater), Math.pow(depth, 0.6));
  } else {
    const span = Math.max(s.maxHeight - s.seaLevel, 1e-4);
    const t = clamp((s.height - s.seaLevel) / span, 0, 1);
    if (t < 0.05) {
      color = mix(hexToRgb(p.shore), hexToRgb(p.low), t / 0.05);
    } else if (t < 0.42) {
      color = mix(hexToRgb(p.low), hexToRgb(p.mid), (t - 0.05) / 0.37);
    } else {
      color = mix(hexToRgb(p.mid), hexToRgb(p.high), smoothstep(0.42, 0.85, t));
    }
    // Rock shows through on steep ground.
    color = mix(color, hexToRgb(p.high), smoothstep(0.28, 0.62, s.slope) * 0.75);
    // Snow (or polar frost) on high, cold ground.
    const cold = clamp(t * 1.1 + Math.pow(s.latitude, 5) * 0.55, 0, 2);
    color = mix(color, hexToRgb(p.peak), smoothstep(0.78, 1.08, cold) * (1 - s.slope * 0.5));
  }

  if (s.carved > 0) {
    const span = Math.max(s.maxHeight - s.seaLevel, 1e-4);
    color = mix(color, hexToRgb(p.crater), smoothstep(0, span * 0.4, s.carved) * 0.7);
  }
  return color;
}
