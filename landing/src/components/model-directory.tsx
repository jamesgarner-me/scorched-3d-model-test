import { ModelCard } from '@/components/model-card'
import type { ModelSite } from '@/lib/models'

export function ModelDirectory({ sites }: { sites: readonly ModelSite[] }) {
  return (
    <ul aria-label="Available builds" className="grid gap-3">
      {sites.map((site) => (
        <li key={site.folder}>
          <ModelCard site={site} />
        </li>
      ))}
    </ul>
  )
}
