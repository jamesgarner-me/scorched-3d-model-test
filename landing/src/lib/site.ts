import { z } from 'zod'

/**
 * Vercel injects the production domain, so the canonical URL used by the
 * metadata, sitemap and robots routes never has to be hardcoded. Set
 * `NEXT_PUBLIC_SITE_URL` to override it for a custom domain.
 */
function resolveSiteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL
  }

  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  }

  return 'http://localhost:3000'
}

const siteUrl = z
  .url({ normalize: true })
  .transform((value) => value.replace(/\/+$/, ''))
  .parse(resolveSiteUrl())

export const siteConfig = {
  url: siteUrl,
  name: 'Scorched 3D',
  tagline: 'One-shot model comparison',
  description:
    'A directory of the Scorched 3D builds: the same planetary artillery brief, handed once to each model and deployed exactly as it came back.',
  repository: 'https://github.com/jamesgarner-me/scorched-3d-model-test',
} as const
