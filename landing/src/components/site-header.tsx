import { siteConfig } from '@/lib/site'

export function SiteHeader() {
  return (
    <header>
      <p className="text-[0.68rem] tracking-[0.28em] text-amber-dim uppercase">
        {siteConfig.tagline}
      </p>
      <h1 className="font-display text-[clamp(3rem,11vw,5.5rem)]/[0.85] font-bold tracking-wide text-amber uppercase">
        {siteConfig.name}
      </h1>
      <p className="mt-2 max-w-2xl text-pretty text-foam/65">
        The same planetary artillery brief, handed once to each model and deployed exactly as it
        came back. Pick a build and take a shot.
      </p>
    </header>
  )
}
