/**
 * A folder can exist under `models/` before it has a Vercel project, so an
 * entry is only rendered as a link once its deployment is `live`.
 */
export type DeploymentStatus = 'live' | 'pending'

export interface ModelSite {
  /** Folder under `models/` that this deployment is built from. */
  folder: string
  /** Model name as it should read on the page. */
  name: string
  /** One neutral line on what this build does differently. */
  blurb: string
  /** Production URL, or `null` while the deployment is `pending`. */
  url: string | null
  status: DeploymentStatus
}

/**
 * Ordered alphabetically by folder rather than by preference — this is a
 * directory, not a leaderboard, and the point of the comparison is lost if the
 * page implies a ranking.
 */
export const modelSites: ModelSite[] = [
  {
    folder: 'astra',
    name: 'Astra',
    blurb:
      'Earth and Mars presets with three AI difficulties, over a single shared simulation core.',
    url: 'https://scorched-3d-astra.vercel.app',
    status: 'live',
  },
  {
    folder: 'fable-5.1',
    name: 'Fable 5.1',
    blurb: 'Seeded worlds under a layered scene of terrain, water, cloud and atmosphere.',
    url: 'https://scorched-3d-fable-51.vercel.app',
    status: 'live',
  },
  {
    folder: 'grok-4.6',
    name: 'Grok 4.6',
    blurb: 'A survey-then-fire flow whose trajectory guide deliberately hides the landing point.',
    url: 'https://scorched-3d-grok-46.vercel.app',
    status: 'live',
  },
  {
    folder: 'opus-5',
    name: 'Opus 5',
    blurb: 'Terra and Ares worlds, three named opponents, and craters that persist all match.',
    url: 'https://scorched-3d-opus-5.vercel.app',
    status: 'live',
  },
]

export const repoUrl = 'https://github.com/jamesgarner-me/scorched-3d-model-test'
