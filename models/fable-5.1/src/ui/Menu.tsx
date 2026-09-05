import { DIFFICULTIES } from '../sim/ai'
import { PRESETS, type PresetId } from '../sim/presets'
import { game } from '../state/game'
import { useStore } from '../state/store'

export function Menu() {
  const settings = useStore((s) => s.settings)
  return (
    <div className="screen menu">
      <div className="menu-card">
        <div className="eyebrow">Turn-based artillery on a small world</div>
        <h1>Planetary Artillery</h1>
        <p className="lede">
          One tank, one enemy, one freshly generated planet. Read the curve of the horizon, lean into the wind, and carve
          the ground out from under them.
        </p>

        <div className="section-label">Planet</div>
        <div className="choice-row">
          {(Object.keys(PRESETS) as PresetId[]).map((id) => {
            const p = PRESETS[id]
            const active = settings.preset === id
            return (
              <button key={id} className={`choice preset-${id} ${active ? 'active' : ''}`} onClick={() => game.setSettings({ preset: id })}>
                <span className={`orb orb-${id}`} />
                <span className="choice-body">
                  <span className="choice-title">{p.name}</span>
                  <span className="choice-sub">{p.tagline}</span>
                </span>
              </button>
            )
          })}
        </div>

        <div className="section-label">Opponent</div>
        <div className="choice-row compact">
          {DIFFICULTIES.map((d) => (
            <button key={d.id} className={`choice ${settings.difficulty === d.id ? 'active' : ''}`} onClick={() => game.setSettings({ difficulty: d.id })}>
              <span className="choice-body">
                <span className="choice-title">{d.name}</span>
                <span className="choice-sub">{d.blurb}</span>
              </span>
            </button>
          ))}
        </div>

        <button className="primary" onClick={() => game.newMatch()}>
          Generate planet &amp; play
        </button>

        <div className="controls-hint">
          <span><kbd>←</kbd><kbd>→</kbd> bearing</span>
          <span><kbd>↑</kbd><kbd>↓</kbd> elevation</span>
          <span>hold <kbd>Space</kbd> to charge, release to fire</span>
          <span>drag to orbit · scroll to zoom · <kbd>Esc</kbd> pause</span>
        </div>
      </div>
    </div>
  )
}
