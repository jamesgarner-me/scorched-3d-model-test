import { describe, expect, it } from 'vitest'
import { carveCrater } from './craters.ts'
import { vertexDir, type Planet } from './planet.ts'

function stubPlanet(): Planet {
  const lats = 24
  const lons = 48
  const baseRadius = 20
  const heights = new Float32Array(lats * lons).fill(22)
  const colors = new Float32Array(lats * lons * 3).fill(0.5)
  heights[0] = 18
  return {
    seed: 'test',
    preset: 'earth',
    baseRadius,
    seaLevel: 20,
    lats,
    lons,
    heights,
    colors,
    gravity: 12,
    wind: { vector: [0, 0, 1], strength: 1, bearing: 0 },
    heightAmp: 3,
  }
}

describe('carveCrater', () => {
  it('carves land and leaves a persistent scar', () => {
    const planet = stubPlanet()
    const idx = 12 * 48 + 24
    const before = planet.heights[idx]!
    const dir = vertexDir(planet, 12, 24)
    const impact: [number, number, number] = [dir[0] * before, dir[1] * before, dir[2] * before]
    carveCrater(planet, impact, 8, 3, [], 1)
    expect(planet.heights[idx]!).toBeLessThan(before)
  })

  it('does not carve water', () => {
    const planet = stubPlanet()
    const wet = planet.heights[0]!
    carveCrater(planet, [0, -22, 0], 10, 4, [], 1)
    expect(planet.heights[0]!).toBe(wet)
  })

  it('does not carve under a tank footprint', () => {
    const planet = stubPlanet()
    const idx = 12 * 48 + 24
    const before = planet.heights[idx]!
    const dir = vertexDir(planet, 12, 24)
    carveCrater(planet, [dir[0] * before, dir[1] * before, dir[2] * before], 8, 3, [dir], 6)
    expect(planet.heights[idx]!).toBe(before)
  })
})
