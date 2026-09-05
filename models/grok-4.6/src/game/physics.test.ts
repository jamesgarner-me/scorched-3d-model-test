import { describe, expect, it } from 'vitest'
import { guidePath, simulateBallistic, SIM_DT } from './physics.ts'
import type { Vec3 } from './math.ts'

const sphere = (radius: number) => (_dir: Vec3) => radius

describe('simulateBallistic', () => {
  it('pulls the projectile toward the planet centre', () => {
    const result = simulateBallistic({
      origin: [0, 12, 0],
      velocity: [4, 0, 0],
      gravity: 20,
      wind: [0, 0, 0],
      dt: SIM_DT,
      maxTime: 4,
      sampleHeight: sphere(8),
    })
    const mid = result.path[Math.floor(result.path.length / 2)]!
    expect(mid[1]).toBeLessThan(12)
    expect(result.impact).not.toBeNull()
    expect(Math.hypot(...result.impact!)).toBeLessThan(8.4)
  })

  it('is displaced by wind', () => {
    const calm = simulateBallistic({
      origin: [0, 12, 0],
      velocity: [6, 2, 0],
      gravity: 12,
      wind: [0, 0, 0],
      dt: SIM_DT,
      maxTime: 6,
      sampleHeight: sphere(8),
    })
    const blown = simulateBallistic({
      origin: [0, 12, 0],
      velocity: [6, 2, 0],
      gravity: 12,
      wind: [0, 0, 8],
      dt: SIM_DT,
      maxTime: 6,
      sampleHeight: sphere(8),
    })
    expect(Math.abs(blown.impact![2] - calm.impact![2])).toBeGreaterThan(0.4)
  })

  it('shares one path so the guide is a prefix and never the landing point', () => {
    const result = simulateBallistic({
      origin: [0, 14, 0],
      velocity: [8, 1, 0],
      gravity: 16,
      wind: [0, 0, 0],
      dt: SIM_DT,
      maxTime: 8,
      sampleHeight: sphere(8),
    })
    const guide = guidePath(result, 0.25)
    expect(guide.length).toBeGreaterThan(1)
    expect(guide.length).toBeLessThan(result.path.length)
    expect(guide[guide.length - 1]).not.toEqual(result.impact)
    expect(guide[0]).toEqual(result.path[0])
  })
})
