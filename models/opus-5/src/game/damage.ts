import { tuning } from './tuning';
import { clamp, dist, type Vec3 } from './vec';
import type { ImpactKind } from './physics';

/**
 * Blast damage: maximum at the centre, falling to exactly zero at the blast radius,
 * so near-misses still matter but distant ones cost nothing.
 */
export function blastDamage(distance: number, radius: number, maxDamage: number, falloff: number): number {
  if (!(radius > 0) || distance >= radius) return 0;
  const t = 1 - clamp(distance, 0, radius) / radius;
  return maxDamage * Math.pow(t, falloff);
}

export interface BlastProfile {
  radius: number;
  maxDamage: number;
}

/** A water splash still hurts a shoreline tank — just less, and over a smaller area. */
export function blastProfile(kind: ImpactKind): BlastProfile {
  const scale = kind === 'water' ? tuning.splashDamageScale : 1;
  return {
    radius: tuning.blastRadius * (kind === 'water' ? 0.8 : 1),
    maxDamage: tuning.maxDamage * scale,
  };
}

/** Damage a blast at `impact` deals to a tank body centred just above `tankPosition`. */
export function damageToTank(impact: Vec3, tankPosition: Vec3, profile: BlastProfile): number {
  return blastDamage(dist(impact, tankPosition), profile.radius, profile.maxDamage, tuning.blastFalloff);
}
