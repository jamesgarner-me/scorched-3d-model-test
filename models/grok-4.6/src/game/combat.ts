import { clamp } from './math.ts'

export function blastDamage(distance: number, maxDamage: number, blastRadius: number): number {
  if (distance >= blastRadius || blastRadius <= 0) return 0
  const t = 1 - distance / blastRadius
  return maxDamage * t * t
}

export function applyVariance(
  value: number,
  amount: number,
  rng: () => number,
): number {
  return value * (1 + (rng() * 2 - 1) * amount)
}

export function applyAngleJitter(radians: number, amount: number, rng: () => number): number {
  return radians + (rng() * 2 - 1) * amount * 0.18
}

export function remainingHealth(current: number, damage: number): number {
  return clamp(current - damage, 0, current)
}
