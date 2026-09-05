import { describe, expect, it } from 'vitest'
import { generatePlanet, isWater, sampleHeight } from './planet.ts'

describe('generatePlanet', () => {
  it('is deterministic for a logged seed', async () => {
    const a = await generatePlanet({ seed: 'alpha-9', preset: 'earth', lats: 16, lons: 32 })
    const b = await generatePlanet({ seed: 'alpha-9', preset: 'earth', lats: 16, lons: 32 })
    expect(a.baseRadius).toBe(b.baseRadius)
    expect(Array.from(a.heights)).toEqual(Array.from(b.heights))
    expect(a.wind.strength).toBe(b.wind.strength)
  })

  it('makes Earth wetter than Mars', async () => {
    const earth = await generatePlanet({ seed: 'wet-1', preset: 'earth', lats: 16, lons: 32 })
    const mars = await generatePlanet({ seed: 'wet-1', preset: 'mars', lats: 16, lons: 32 })
    let earthWater = 0
    let marsWater = 0
    for (let i = 0; i < earth.heights.length; i += 1) {
      if (earth.heights[i]! < earth.seaLevel) earthWater += 1
      if (mars.heights[i]! < mars.seaLevel) marsWater += 1
    }
    expect(earthWater).toBeGreaterThan(marsWater)
    expect(sampleHeight(earth, [0, 1, 0])).toBeGreaterThan(0)
    expect(typeof isWater(earth, [0, 1, 0])).toBe('boolean')
  })
})
