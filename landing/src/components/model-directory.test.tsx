import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { ModelDirectory } from '@/components/model-directory'
import type { ModelSite } from '@/lib/models'

const sites: ModelSite[] = [
  {
    folder: 'grok-4.6',
    name: 'Grok 4.6',
    blurb: 'A survey-then-fire flow whose trajectory guide hides the landing point.',
    status: 'live',
    url: 'https://scorched-3d-grok-46.vercel.app',
  },
  {
    folder: 'opus-5',
    name: 'Opus 5',
    blurb: 'Terra and Ares worlds, three named opponents, craters that persist all match.',
    status: 'live',
    url: 'https://scorched-3d-opus-5.vercel.app',
  },
  {
    folder: 'sonnet-5',
    name: 'Sonnet 5',
    blurb: 'Generated but not yet deployed.',
    status: 'pending',
  },
]

describe('ModelDirectory', () => {
  // The whole purpose of the page: one working outbound link per deployed
  // build, in the order given, announced as leaving the site.
  it('lists every deployed build as a link to its own deployment', () => {
    render(<ModelDirectory sites={sites} />)

    expect(screen.getAllByRole('listitem')).toHaveLength(sites.length)

    const grok = screen.getByRole('link', { name: /Grok 4\.6/ })
    expect(grok).toHaveAttribute('href', 'https://scorched-3d-grok-46.vercel.app')
    expect(grok).toHaveAttribute('target', '_blank')
    expect(grok).toHaveAttribute('rel', 'noopener noreferrer')
    expect(grok).toHaveAccessibleName(expect.stringContaining('models/grok-4.6'))
    expect(grok).toHaveAccessibleName(expect.stringContaining('opens in a new tab'))

    expect(screen.getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual([
      'https://scorched-3d-grok-46.vercel.app',
      'https://scorched-3d-opus-5.vercel.app',
    ])
  })

  // A model folder can be committed before its Vercel project exists, and a
  // link with nowhere to go is worse than no link: the row must still render,
  // say so, and stay out of the tab order.
  it('renders a build with no deployment as an inert row rather than a link', async () => {
    const user = userEvent.setup()
    render(<ModelDirectory sites={sites} />)

    expect(screen.queryByRole('link', { name: /Sonnet 5/ })).not.toBeInTheDocument()
    expect(screen.getByText('Sonnet 5')).toBeVisible()
    expect(screen.getByText('Not deployed')).toBeVisible()

    await user.tab()
    expect(screen.getByRole('link', { name: /Grok 4\.6/ })).toHaveFocus()

    await user.tab()
    expect(screen.getByRole('link', { name: /Opus 5/ })).toHaveFocus()

    // Nothing else in the list is focusable, so focus falls out of it entirely.
    await user.tab()
    expect(document.body).toHaveFocus()
  })
})
