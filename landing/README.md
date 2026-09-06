# landing

The directory page for the comparison: a list of links, one per deployed model
build. It is not part of the comparison itself, so unlike the folders under
`models/` this one can be iterated freely.

## Run

```bash
npm install
npm run dev
```

```bash
npm run build         # production build; every route prerenders to static
npm start             # serve the production build
npm test              # component and schema tests
npm run typecheck     # next typegen && tsc --noEmit
npm run lint          # eslint
npm run format        # prettier --write
```

## Stack

Scaffolded with `create-next-app` and kept close to the generated defaults, so
the config is the framework's rather than ours.

| Concern             | Handled by                                                                                                                                                                          |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rendering           | Next.js App Router. Nothing is a Client Component, so the page ships no application JavaScript.                                                                                     |
| Styling             | Tailwind CSS v4. The palette is registered as `@theme` tokens in `src/app/globals.css` and consumed as ordinary utilities.                                                          |
| Conditional styling | `class-variance-authority` for the live/pending card variants, `tailwind-merge` behind `cn()` for overrides.                                                                        |
| Data integrity      | Zod. `src/lib/models.ts` parses `src/data/models.json` at module load, so an invalid entry fails `next build`.                                                                      |
| SEO and social      | The Metadata API, plus generated `sitemap.ts`, `robots.ts`, `icon.svg` and `opengraph-image.tsx` routes.                                                                            |
| Fonts               | `next/font/google`, which self-hosts and preloads Antonio and IBM Plex Mono. No external font requests.                                                                             |
| Icons               | `lucide-react`.                                                                                                                                                                     |
| Linting             | `eslint-config-next` plus the full `eslint-plugin-jsx-a11y` rule set, `eslint-plugin-testing-library` and `@vitest/eslint-plugin` on test files, and `eslint-config-prettier` last. |
| Formatting          | Prettier with `prettier-plugin-tailwindcss`, so class order is never reviewed by hand.                                                                                              |
| Tests               | Vitest and React Testing Library, configured as the Next.js testing guide describes.                                                                                                |

Two pins are deliberate:

- **ESLint 9, not 10.** `eslint-plugin-jsx-a11y` does not yet declare support
  for ESLint 10. The full accessibility rule set is worth more here than the
  major version.
- **npm 12 or newer for `npm install`.** npm 10 cannot build an ideal tree for
  the Vitest peer graph and fails with `Cannot read properties of null (reading
'edgesOut')`. `package-lock.json` is committed, so `npm ci` — the path Vercel
  takes — works on any npm.

## Deployment

Its own Vercel project with `landing` as the project Root Directory, the same
arrangement every model folder uses. Next.js is detected automatically, so there
is no `vercel.json` and no build configuration.

The canonical URL used by the metadata, sitemap and robots routes comes from
Vercel's `VERCEL_PROJECT_PRODUCTION_URL` and needs no setup. Set
`NEXT_PUBLIC_SITE_URL` to override it for a custom domain. Both are read at
build time, because the page is prerendered.

## Adding a model

Append an entry to `src/data/models.json`. Nothing else needs to change: the
list, the structured data, and the Open Graph image all derive from it.

```json
{
  "folder": "sonnet-5",
  "name": "Sonnet 5",
  "status": "live",
  "url": "https://scorched-3d-sonnet-5.vercel.app"
}
```

Vercel project names drop the dots from the folder name, so `models/grok-4.6` is
served from `scorched-3d-grok-46.vercel.app`.

If the folder is committed before its Vercel project exists, use
`"status": "pending"` and omit `url`. The row then renders as an inert
placeholder rather than a dead link, and the schema will reject the entry if it
carries a URL anyway.

Order does not matter. Entries are sorted by folder when they are parsed,
because this is a directory rather than a leaderboard and a page whose ordering
implies a result would undermine the comparison it exists to present.
