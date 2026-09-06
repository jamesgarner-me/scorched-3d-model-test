import type { MetadataRoute } from 'next'

import { siteConfig } from '@/lib/site'

/**
 * Only this page. The builds it links to are separate Vercel projects on their
 * own origins, so each is responsible for its own sitemap.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: siteConfig.url,
      changeFrequency: 'monthly',
      priority: 1,
    },
  ]
}
