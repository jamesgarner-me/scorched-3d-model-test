import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { ModelDirectory } from '@/components/model-directory'
import type { ModelSite } from '@/lib/models'

const sites: ModelSite[] = [
  {
    folder: 'grok-4.6',
    name: 'Grok 4.6',
    status: 'live',
    url: 'https://scorched-3d-grok-46.vercel.app',
  },
  {
    folder: 'opus-5',
    name: 'Opus 5',
    status: 'live',
    url: 'https://scorched-3d-opus-5.vercel.app',
  },
  {
    folder: 'sonnet-5',
    name: 'Sonnet 5',
    status: 'pending',
  },
]

describe('ModelDirectory', () => {
  // The whole purpose of the page: every deployed build can be launched as
  // player versus computer or as a computer versus computer demo, in the order
  // given, each announced as leaving the site.
  it('offers a play link and a demo link for every deployed build', () => {
    render(<ModelDirectory sites={sites} />)

    expect(screen.getAllByRole('listitem')).toHaveLength(sites.length)

    const play = screen.getByRole('link', { name: /^Play Grok 4\.6/ })
    expect(play).toHaveAttribute('href', 'https://scorched-3d-grok-46.vercel.app')
    expect(play).toHaveAttribute('target', '_blank')
    expect(play).toHaveAttribute('rel', 'noopener noreferrer')
    expect(play).toHaveAccessibleName(expect.stringContaining('models/grok-4.6'))
    expect(play).toHaveAccessibleName(expect.stringContaining('opens in a new tab'))

    const demo = screen.getByRole('link', { name: /^Demo Grok 4\.6/ })
    expect(demo).toHaveAttribute('href', 'https://scorched-3d-grok-46.vercel.app/?mode=demo')
    expect(demo).toHaveAttribute('target', '_blank')
    expect(demo).toHaveAttribute('rel', 'noopener noreferrer')

    expect(screen.getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual([
      'https://scorched-3d-grok-46.vercel.app',
      'https://scorched-3d-grok-46.vercel.app/?mode=demo',
      'https://scorched-3d-opus-5.vercel.app',
      'https://scorched-3d-opus-5.vercel.app/?mode=demo',
    ])
  })

  // A model folder can be committed before its Vercel project exists, and a
  // link with nowhere to go is worse than no link: the row must still render,
  // say so, offer neither launch, and stay out of the tab order.
  it('renders a build with no deployment as an inert row rather than links', async () => {
    const user = userEvent.setup()
    render(<ModelDirectory sites={sites} />)

    expect(screen.queryByRole('link', { name: /Sonnet 5/ })).not.toBeInTheDocument()
    expect(screen.getByText('Sonnet 5')).toBeVisible()
    expect(screen.getByText('Not deployed')).toBeVisible()

    for (const name of [/^Play Grok/, /^Demo Grok/, /^Play Opus/, /^Demo Opus/]) {
      await user.tab()
      expect(screen.getByRole('link', { name })).toHaveFocus()
    }

    // Nothing else in the list is focusable, so focus falls out of it entirely.
    await user.tab()
    expect(document.body).toHaveFocus()
  })
})
