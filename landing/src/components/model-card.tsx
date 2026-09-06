import { cva } from 'class-variance-authority'
import { ArrowUpRight, CircleDashed } from 'lucide-react'

import type { ModelSite } from '@/lib/models'

const card = cva(
  'group flex flex-col gap-2 border px-5 py-4 transition-colors motion-safe:duration-150',
  {
    variants: {
      status: {
        live: [
          'border-amber/25 bg-ink/70',
          'hover:border-amber hover:bg-amber/8',
          'focus-visible:border-amber focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber',
        ],
        pending: 'border-dashed border-amber/20 bg-ink/40 opacity-60',
      },
    },
  },
)

const action = cva('flex items-center gap-1.5 text-[0.68rem] tracking-[0.22em] uppercase', {
  variants: {
    status: {
      live: 'text-amber-dim group-hover:text-amber group-focus-visible:text-amber',
      pending: 'text-amber-dim',
    },
  },
})

function CardContents({ site }: { site: ModelSite }) {
  return (
    <>
      <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <strong className="font-display text-2xl font-bold tracking-wide text-amber uppercase">
          {site.name}
        </strong>
        <span className="text-[0.7rem] tracking-[0.14em] text-amber-dim uppercase">
          models/{site.folder}
        </span>
      </span>

      <span className={action({ status: site.status })}>
        {site.status === 'live' ? (
          <>
            Play
            <ArrowUpRight aria-hidden className="size-3.5" />
            <span className="sr-only">(opens in a new tab)</span>
          </>
        ) : (
          <>
            Not deployed
            <CircleDashed aria-hidden className="size-3.5" />
          </>
        )}
      </span>
    </>
  )
}

/**
 * A build with no deployment renders as plain content rather than a link, so a
 * folder committed ahead of its Vercel project never becomes a dead end. Its
 * state is carried by visible text instead of `aria-disabled`, which has no
 * meaning on a non-interactive element.
 */
export function ModelCard({ site }: { site: ModelSite }) {
  if (site.status === 'pending') {
    return (
      <div className={card({ status: 'pending' })}>
        <CardContents site={site} />
      </div>
    )
  }

  return (
    <a
      className={card({ status: 'live' })}
      href={site.url}
      target="_blank"
      rel="noopener noreferrer"
    >
      <CardContents site={site} />
    </a>
  )
}
