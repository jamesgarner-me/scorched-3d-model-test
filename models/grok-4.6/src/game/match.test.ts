import { describe, expect, it } from 'vitest'
import { MatchEngine } from './match.ts'

describe('MatchEngine demo mode', () => {
  it('flags a spectator survey and locks turret input', () => {
    const demo = new MatchEngine(true)
    const live = new MatchEngine(false)
    expect(demo.getSnapshot().demo).toBe(true)
    expect(live.getSnapshot().demo).toBe(false)
    expect(demo.inputLocked()).toBe(true)
    expect(live.inputLocked()).toBe(false)
  })
})
