import { siteConfig } from '@/lib/site'

export function SiteFooter() {
  return (
    <footer className="border-t border-amber/20 pt-5 text-xs/relaxed text-foam/65">
      <p>
        Every build is a frozen first generation from the shared brief. Source and requirements live
        in{' '}
        <a
          className="text-amber underline decoration-amber-dim underline-offset-4 hover:decoration-amber focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber"
          href={siteConfig.repository}
          target="_blank"
          rel="noopener noreferrer"
        >
          the repository
          <span className="sr-only">(opens in a new tab)</span>
        </a>
        .
      </p>
    </footer>
  )
}
