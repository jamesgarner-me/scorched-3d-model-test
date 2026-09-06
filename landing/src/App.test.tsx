import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ModelSite } from './models'

const fakeSites: ModelSite[] = [
  {
    folder: 'grok-4.6',
    name: 'Grok 4.6',
    blurb: 'A survey-then-fire flow whose trajectory guide hides the landing point.',
    url: 'https://scorched-3d-grok-46.vercel.app',
    status: 'live',
  },
  {
    folder: 'opus-5',
    name: 'Opus 5',
    blurb: 'Terra and Ares worlds, three named opponents, craters that persist all match.',
    url: 'https://scorched-3d-opus-5.vercel.app',
    status: 'live',
  },
  {
    folder: 'sonnet-5',
    name: 'Sonnet 5',
    blurb: 'Generated but not yet deployed.',
    url: null,
    status: 'pending',
  },
]

vi.mock('./models', () => ({
  modelSites: fakeSites,
  repoUrl: 'https://github.com/jamesgarner-me/scorched-3d-model-test',
}))

const { default: App } = await import('./App')

let consoleErrorSpy: ReturnType<typeof vi.spyOn>
let consoleWarnSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, 'error')
  consoleWarnSpy = vi.spyOn(console, 'warn')
})

// A React act() warning means a state change escaped the test's control, so
// treat one as a failure rather than noise in the output.
afterEach(() => {
  const logged = [...consoleErrorSpy.mock.calls, ...consoleWarnSpy.mock.calls]
    .map((call) => String(call[0]))
    .join('\n')

  expect(logged).not.toMatch(/not wrapped in act|act\(\.\.\.\)/)
  vi.restoreAllMocks()
})

describe('App', () => {
  // The whole point of the page: one working outbound link per deployed build,
  // in the order the data declares, opened without leaking the referrer.
  it('lists every deployed build as a link to its Vercel deployment', () => {
    render(<App />)

    const entries = screen.getAllByRole('listitem')
    expect(entries).toHaveLength(fakeSites.length)

    const grok = screen.getByRole('link', { name: /Grok 4\.6/ })
    expect(grok).toHaveAttribute('href', 'https://scorched-3d-grok-46.vercel.app')
    expect(grok).toHaveAttribute('target', '_blank')
    expect(grok).toHaveAttribute('rel', 'noopener noreferrer')
    expect(grok).toHaveTextContent('models/grok-4.6')

    const opus = screen.getByRole('link', { name: /Opus 5/ })
    expect(opus).toHaveAttribute('href', 'https://scorched-3d-opus-5.vercel.app')

    const deploymentNames = screen
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'))
      .filter((href) => href?.includes('vercel.app'))
    expect(deploymentNames).toEqual([
      'https://scorched-3d-grok-46.vercel.app',
      'https://scorched-3d-opus-5.vercel.app',
    ])
  })

  // A model folder can be committed before its Vercel project exists, and a
  // link with nowhere to go is worse than no link: the row must render, say so,
  // and stay out of the tab order.
  it('renders a build with no deployment as an inert row rather than a link', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(screen.queryByRole('link', { name: /Sonnet 5/ })).not.toBeInTheDocument()

    const pending = screen.getByText('Sonnet 5').closest('.entry')
    expect(pending).toHaveAttribute('aria-disabled', 'true')
    expect(pending).toHaveTextContent('Not deployed')

    await user.tab()
    expect(screen.getByRole('link', { name: /Grok 4\.6/ })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('link', { name: /Opus 5/ })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('link', { name: /the repository/ })).toHaveFocus()
  })
})
