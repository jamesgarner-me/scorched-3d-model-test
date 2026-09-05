import { describe, expect, it } from 'vitest'
import { solveAim } from './ai.ts'
import { generatePlanet, surfacePoint } from './planet.ts'
import { simulateBallistic, SIM_DT } from './physics.ts'
import { sampleHeight } from './planet.ts'
import { aimDirection, localFrame } from './math.ts'

describe('solveAim', () => {
  it('uses the shared ballistic simulator and returns a finite aim', async () => {
    const planet = await generatePlanet({ seed: 'ai-1', preset: 'mars', lats: 16, lons: 32 })
    const from = surfacePoint(planet, [0, 1, 0])
    const target = surfacePoint(planet, [0, 0, 1])
    const solution = solveAim({
      planet,
      from,
      target,
      difficulty: 'hard',
      memory: { lastImpact: null, lastAim: null, lastMiss: 0 },
      seed: 'ai-1',
      turn: 1,
      gravity: planet.gravity,
      wind: planet.wind.vector,
      maxSpeed: 38,
      minElevation: 6,
      maxElevation: 82,
    })
    expect(Number.isFinite(solution.bearing)).toBe(true)
    expect(solution.power).toBeGreaterThan(0)
    const frame = localFrame(from)
    const dir = aimDirection(frame, solution.bearing, solution.elevation)
    const result = simulateBallistic({
      origin: from,
      velocity: [dir[0] * solution.power * 38, dir[1] * solution.power * 38, dir[2] * solution.power * 38],
      gravity: planet.gravity,
      wind: planet.wind.vector,
      dt: SIM_DT,
      maxTime: 12,
      sampleHeight: (d) => sampleHeight(planet, d),
    })
    expect(result.path.length).toBeGreaterThan(2)
  })
})
