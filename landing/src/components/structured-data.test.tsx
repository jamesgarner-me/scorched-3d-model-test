import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { StructuredData } from '@/components/structured-data'
import type { ModelSite } from '@/lib/models'

const sites: ModelSite[] = [
  {
    folder: 'grok-4.6',
    name: 'Grok 4.6',
    lab: 'xAI',
    status: 'live',
    url: 'https://scorched-3d-grok-46.vercel.app',
  },
  {
    folder: 'sonnet-5',
    name: 'Sonnet 5',
    lab: 'Anthropic',
    status: 'pending',
  },
]

describe('StructuredData', () => {
  // Search engines see only this markup, so each deployed build must carry its
  // lab as the creator, and a build with nowhere to go must not be listed.
  it('lists deployed builds with their lab as creator', () => {
    const { container } = render(<StructuredData sites={sites} />)

    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    const script = container.querySelector('script[type="application/ld+json"]')
    const data: { itemListElement: unknown[] } = JSON.parse(script?.textContent ?? '{}')

    expect(data.itemListElement).toEqual([
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Grok 4.6',
        url: 'https://scorched-3d-grok-46.vercel.app',
        item: {
          '@type': 'VideoGame',
          name: 'Grok 4.6',
          url: 'https://scorched-3d-grok-46.vercel.app',
          creator: { '@type': 'Organization', name: 'xAI' },
        },
      },
    ])
  })
})
