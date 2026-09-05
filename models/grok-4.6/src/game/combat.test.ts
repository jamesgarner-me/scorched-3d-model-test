import { describe, expect, it } from 'vitest'
import { blastDamage, remainingHealth } from './combat.ts'

describe('blastDamage', () => {
  it('deals max damage at the centre and zero beyond the radius', () => {
    expect(blastDamage(0, 200, 8)).toBe(200)
    expect(blastDamage(8, 200, 8)).toBe(0)
    expect(blastDamage(9, 200, 8)).toBe(0)
  })

  it('falls off inside the blast radius', () => {
    const mid = blastDamage(4, 200, 8)
    expect(mid).toBeGreaterThan(0)
    expect(mid).toBeLessThan(200)
    expect(blastDamage(2, 200, 8)).toBeGreaterThan(mid)
  })

  it('lets two strong centre hits empty a 400 HP tank', () => {
    const hp = remainingHealth(remainingHealth(400, blastDamage(0, 200, 8)), blastDamage(0, 200, 8))
    expect(hp).toBe(0)
  })
})
