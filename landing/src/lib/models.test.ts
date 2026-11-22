import { describe, expect, it } from 'vitest'

import { demoUrl, modelSites, modelSitesSchema } from '@/lib/models'

const identity = {
  folder: 'opus-5',
  name: 'Opus 5',
  lab: 'Anthropic' as const,
}

const live = { ...identity, status: 'live', url: 'https://scorched-3d-opus-5.vercel.app' }

const pending = {
  folder: 'sonnet-5',
  name: 'Sonnet 5',
  lab: 'Anthropic',
  status: 'pending',
}

const unattributed = { folder: live.folder, name: live.name, status: live.status, url: live.url }

const invalidCases: [description: string, data: unknown][] = [
  ['a duplicated folder', [live, { ...live, url: 'https://elsewhere.example' }]],
  ['a duplicated deployment', [live, { ...live, folder: 'opus-5-rerun' }]],
  ['a live build with no URL', [{ ...identity, status: 'live' }]],
  ['a pending build with a URL', [{ ...pending, url: 'https://scorched-3d-sonnet-5.vercel.app' }]],
  ['an insecure URL', [{ ...live, url: 'http://scorched-3d-opus-5.vercel.app' }]],
  ['an unrecognised field', [{ ...live, rank: 1 }]],
  ['a leftover blurb', [{ ...live, blurb: 'one line on what this build does' }]],
  ['an empty directory', []],
  ['a build with no lab', [unattributed]],
  ['an unknown lab', [{ ...live, lab: 'Acme' }]],
  ['a lab spelt in the wrong case', [{ ...live, lab: 'XAI' }]],
]

describe('modelSitesSchema', () => {
  // This schema is the only thing standing between a hand-edited JSON file and
  // a directory page full of dead or duplicated links, so its guarantees are
  // worth pinning down individually.
  it('accepts valid entries and sorts them so the page implies no ranking', () => {
    const result = modelSitesSchema.safeParse([pending, live])

    expect(result.success).toBe(true)
    expect(result.data?.map((site) => site.folder)).toEqual(['opus-5', 'sonnet-5'])
  })

  it.each(invalidCases)('rejects %s', (_description, data) => {
    expect(modelSitesSchema.safeParse(data).success).toBe(false)
  })
})

describe('demoUrl', () => {
  // Every build reads `?mode=demo`, so the link must carry exactly that query
  // whatever shape the deployment URL takes.
  it('adds the demo query to a bare or pathed deployment URL', () => {
    expect(
      demoUrl({ ...identity, status: 'live', url: 'https://scorched-3d-opus-5.vercel.app' }),
    ).toBe('https://scorched-3d-opus-5.vercel.app/?mode=demo')
    expect(
      demoUrl({ ...identity, status: 'live', url: 'https://example.com/opus/?mode=play' }),
    ).toBe('https://example.com/opus/?mode=demo')
  })
})

describe('modelSites', () => {
  // Parsing runs at module load, so a bad edit fails `next build` instead of
  // reaching production. Importing this at all proves the committed JSON is
  // valid; the ordering check proves the sort actually applied to it.
  it('exposes the committed directory data in alphabetical order', () => {
    const folders = modelSites.map((site) => site.folder)

    expect(folders.length).toBeGreaterThan(0)
    expect(folders).toStrictEqual([...folders].sort((a, b) => a.localeCompare(b, 'en')))
  })
})
