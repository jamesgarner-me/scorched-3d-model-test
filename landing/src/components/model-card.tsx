import { cva } from 'class-variance-authority'
import { ArrowUpRight, CircleDashed } from 'lucide-react'

import { demoUrl, type LiveModelSite, type ModelSite } from '@/lib/models'

const card = cva(
  'flex flex-col gap-2 border px-5 py-4 transition-colors motion-safe:duration-150',
  {
    variants: {
      status: {
        live: 'border-amber/25 bg-ink/70 focus-within:border-amber hover:border-amber hover:bg-amber/8',
        pending: 'border-dashed border-amber/20 bg-ink/40 opacity-60',
      },
    },
  },
)

const action = cva('flex items-center gap-1.5 text-[0.68rem] tracking-[0.22em] uppercase', {
  variants: {
    status: {
      live: [
        'text-amber-dim hover:text-amber focus-visible:text-amber',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber',
      ],
      pending: 'text-amber-dim',
    },
  },
})

function CardHeading({ site }: { site: ModelSite }) {
  return (
    <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <strong className="font-display text-2xl font-bold tracking-wide text-amber uppercase">
        {site.name}
      </strong>
      <span className="text-[0.7rem] tracking-[0.14em] text-amber-dim uppercase">
        models/{site.folder}
      </span>
    </span>
  )
}

function LaunchLink({ href, label, site }: { href: string; label: string; site: LiveModelSite }) {
  return (
    <a
      aria-label={`${label} ${site.name} (models/${site.folder}, opens in a new tab)`}
      className={action({ status: 'live' })}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
    >
      {label}
      <ArrowUpRight aria-hidden className="size-3.5" />
    </a>
  )
}

/**
 * A build with no deployment renders as plain content rather than links, so a
 * folder committed ahead of its Vercel project never becomes a dead end. Its
 * state is carried by visible text instead of `aria-disabled`, which has no
 * meaning on a non-interactive element.
 *
 * A live build offers two launches, player versus computer and computer versus
 * computer, so the card is a container for two links rather than one link.
 */
export function ModelCard({ site }: { site: ModelSite }) {
  if (site.status === 'pending') {
    return (
      <div className={card({ status: 'pending' })}>
        <CardHeading site={site} />
        <span className={action({ status: 'pending' })}>
          Not deployed
          <CircleDashed aria-hidden className="size-3.5" />
        </span>
      </div>
    )
  }

  return (
    <div className={card({ status: 'live' })}>
      <CardHeading site={site} />
      <span className="flex flex-wrap gap-x-6 gap-y-1">
        <LaunchLink href={site.url} label="Play" site={site} />
        <LaunchLink href={demoUrl(site)} label="Demo" site={site} />
      </span>
    </div>
  )
}
