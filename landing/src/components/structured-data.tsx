import type { ModelSite } from '@/lib/models'
import { siteConfig } from '@/lib/site'

/**
 * Search engines read a directory page through its list markup, so the
 * `ItemList` is generated from the same source as the visible list rather than
 * maintained alongside it.
 */
export function StructuredData({ sites }: { sites: readonly ModelSite[] }) {
  const live = sites.filter((site) => site.status === 'live')

  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${siteConfig.name} builds`,
    description: siteConfig.description,
    itemListOrder: 'https://schema.org/ItemListUnordered',
    numberOfItems: live.length,
    itemListElement: live.map((site, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: site.name,
      description: site.blurb,
      url: site.url,
    })),
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList) }}
    />
  )
}
