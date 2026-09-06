# landing

The directory page for the comparison: a plain list of links, one per deployed
model build. It is not part of the comparison itself, so unlike the folders
under `models/` this one can be iterated freely.

## Run

```bash
npm install
npm run dev
```

```bash
npm run build      # static site in dist/
npm run preview    # serve the production build
npm test           # rendering and link-data tests
npm run lint       # oxlint
npm run format     # prettier --write
```

## Deployment

Its own Vercel project, with `landing` as the project Root Directory and the
Vite preset — the same arrangement every model folder uses. Static output, no
environment variables, no runtime services.

`package-lock.json` is committed so that Vercel resolves with `npm ci`. Do not
regenerate it with npm 10, which cannot build an ideal tree for the Vitest 4
peer graph; use npm 12 or newer.

## Adding a model

Add one entry to `modelSites` in `src/models.ts`. Nothing else needs to change.

```ts
{
  folder: 'sonnet-5',
  name: 'Sonnet 5',
  blurb: 'One neutral line on what this build does differently.',
  url: 'https://scorched-3d-sonnet-5.vercel.app',
  status: 'live',
}
```

Vercel project names drop the dots from the folder name, so `models/grok-4.6`
is served from `scorched-3d-grok-46.vercel.app`. If the folder is committed
before its Vercel project exists, set `status: 'pending'` and `url: null`; the
row then renders as an inert placeholder instead of a dead link.

Entries are kept in alphabetical order by folder, and a test enforces it. This
is a directory rather than a leaderboard, and the comparison is undermined if
the page's ordering implies a result.
