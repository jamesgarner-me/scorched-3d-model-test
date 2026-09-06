import '@testing-library/jest-dom/vitest'

import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, expect, vi } from 'vitest'

const ACT_WARNING = /not wrapped in act|act\(\.\.\.\)/

let consoleErrorSpy: ReturnType<typeof vi.spyOn>
let consoleWarnSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, 'error')
  consoleWarnSpy = vi.spyOn(console, 'warn')
})

/**
 * A React act() warning means a state update escaped the test's control, which
 * makes any assertion after it unreliable. Fail the test rather than let it
 * scroll past in the output.
 */
afterEach(() => {
  cleanup()

  const logged = [...consoleErrorSpy.mock.calls, ...consoleWarnSpy.mock.calls]
    .map((call) => String(call[0]))
    .join('\n')

  expect(logged, 'React logged an act() warning').not.toMatch(ACT_WARNING)
})
