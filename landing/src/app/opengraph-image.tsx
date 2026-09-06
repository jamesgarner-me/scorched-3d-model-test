import { ImageResponse } from 'next/og'

import { modelSites } from '@/lib/models'
import { siteConfig } from '@/lib/site'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = `${siteConfig.name} — ${siteConfig.tagline}`

/**
 * Generated from the directory data at build time, so the share card cannot
 * fall out of step with the list of builds the way a checked-in image would.
 */
export default function OpengraphImage() {
  const live = modelSites.filter((site) => site.status === 'live')

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: 80,
        background: 'linear-gradient(160deg, #07080c 0%, #0c1018 100%)',
        color: '#d7ece4',
        fontFamily: 'sans-serif',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: 28, letterSpacing: 12, color: '#9a6f2e' }}>
          {siteConfig.tagline.toUpperCase()}
        </div>
        <div
          style={{
            fontSize: 132,
            fontWeight: 700,
            letterSpacing: 4,
            lineHeight: 1.1,
            whiteSpace: 'nowrap',
            color: '#f0b45a',
          }}
        >
          {siteConfig.name.toUpperCase()}
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        {live.map((site) => (
          <div
            key={site.folder}
            style={{
              display: 'flex',
              fontSize: 30,
              padding: '12px 24px',
              border: '2px solid rgba(240, 180, 90, 0.35)',
              color: '#f0b45a',
            }}
          >
            {site.name}
          </div>
        ))}
      </div>
    </div>,
    size,
  )
}
