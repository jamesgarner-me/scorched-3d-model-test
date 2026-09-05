import { distance, type V3 } from './vec'

/** Linear fall-off blast damage: max at the centre, zero at the blast radius. */
export function blastDamage(impact: V3, tankPos: V3, blastRadius: number, maxDamage: number): number {
  const d = distance(impact, tankPos)
  if (d >= blastRadius) return 0
  return Math.round(maxDamage * (1 - d / blastRadius))
}
