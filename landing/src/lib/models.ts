import { z } from 'zod'

import modelsData from '@/data/models.json'

const identity = {
  /** Folder under `models/` in the monorepo that this deployment is built from. */
  folder: z.string().regex(/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/, 'must be a lowercase folder name'),
  /** Model name as it should read on the page. */
  name: z.string().min(1),
}

/**
 * Status and URL are modelled as a discriminated union rather than an optional
 * field, so a build with somewhere to go is a different type from one without
 * and the page cannot render a link to `undefined`.
 */
export const modelSiteSchema = z.discriminatedUnion('status', [
  z.strictObject({
    ...identity,
    status: z.literal('live'),
    url: z.url({ protocol: /^https$/, normalize: true }),
  }),
  z.strictObject({
    ...identity,
    status: z.literal('pending'),
  }),
])

export type ModelSite = z.infer<typeof modelSiteSchema>
export type LiveModelSite = Extract<ModelSite, { status: 'live' }>

const uniqueBy = <T>(items: readonly T[], key: (item: T) => string | undefined) => {
  const seen = new Set<string>()
  return items.every((item) => {
    const value = key(item)
    if (value === undefined) return true
    if (seen.has(value)) return false
    seen.add(value)
    return true
  })
}

/**
 * Sorted here rather than validated, so the JSON can be appended to in any
 * order: this is a directory and not a leaderboard, and a page whose ordering
 * implies a result would undermine the comparison it exists to present.
 */
export const modelSitesSchema = z
  .array(modelSiteSchema)
  .min(1)
  .check((ctx) => {
    if (!uniqueBy(ctx.value, (site) => site.folder)) {
      ctx.issues.push({
        code: 'custom',
        message: 'every build must reference a distinct folder',
        input: ctx.value,
      })
    }

    if (!uniqueBy(ctx.value, (site) => (site.status === 'live' ? site.url : undefined))) {
      ctx.issues.push({
        code: 'custom',
        message: 'two builds cannot share one deployment',
        input: ctx.value,
      })
    }
  })
  .transform((sites) => [...sites].sort((a, b) => a.folder.localeCompare(b.folder, 'en')))

function parseModelSites(data: unknown): ModelSite[] {
  const result = modelSitesSchema.safeParse(data)

  // Thrown at module load, which fails `next build` rather than shipping a
  // directory with a dead or duplicated link in it.
  if (!result.success) {
    throw new Error(`Invalid src/data/models.json:\n${z.prettifyError(result.error)}`)
  }

  return result.data
}

export const modelSites = parseModelSites(modelsData)
