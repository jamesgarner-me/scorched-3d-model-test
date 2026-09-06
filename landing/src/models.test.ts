import { describe, expect, it } from 'vitest'
import { modelSites } from './models'

// The directory is only useful if this data stays correct, and it is edited by
// hand every time a model is added. These checks catch the drift that a visual
// glance over the page would not.
describe('modelSites', () => {
  it('gives every build a unique folder, a unique deployment and an HTTPS URL', () => {
    expect(modelSites.length).toBeGreaterThan(0)

    const folders = modelSites.map((site) => site.folder)
    expect(new Set(folders).size).toBe(folders.length)

    const urls = modelSites.map((site) => site.url).filter((url) => url !== null)
    expect(new Set(urls).size).toBe(urls.length)

    for (const url of urls) {
      expect(url).toMatch(/^https:\/\//)
      expect(url).not.toMatch(/\/$/)
    }
  })

  it('is ordered alphabetically by folder so the page implies no ranking', () => {
    const folders = modelSites.map((site) => site.folder)
    expect(folders).toEqual([...folders].sort((a, b) => a.localeCompare(b, 'en')))
  })

  it('only omits a URL when the deployment is pending', () => {
    for (const site of modelSites) {
      expect(site.name.length).toBeGreaterThan(0)
      expect(site.blurb.length).toBeGreaterThan(0)

      if (site.status === 'live') {
        expect(site.url, `${site.folder} is live but has no URL`).not.toBeNull()
      } else {
        expect(site.url, `${site.folder} is pending but has a URL`).toBeNull()
      }
    }
  })
})
