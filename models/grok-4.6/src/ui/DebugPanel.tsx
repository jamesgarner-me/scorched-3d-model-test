import { useEffect, useState } from 'react'
import { tuning, type Timing } from '../game/tuning.ts'
import type { Snapshot } from '../game/match.ts'

const TIMING_NOTE: Record<Timing, string> = {
  live: 'live',
  'next-shot': 'next shot',
  regenerate: 'regenerate',
  'new-match': 'new match',
}

export function DebugPanel({
  snap,
  onSeed,
  onRegen,
}: {
  snap: Snapshot
  onSeed: (seed: string) => void
  onRegen: () => void
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({ Combat: true })
  const [seedDraft, setSeedDraft] = useState(snap.seed)
  useEffect(() => {
    setSeedDraft(snap.seed)
  }, [snap.seed])
  const fields = tuning.all()
  const sections = [...new Set(fields.map((f) => f.section))]

  return (
    <aside className="debug">
      <header>
        <strong>Tuning</strong>
        <span>dev overlay</span>
      </header>
      <section className="debug-metrics">
        <p>FPS {snap.metrics.fps.toFixed(0)}</p>
        <p>frame {snap.metrics.frameMs.toFixed(1)}ms</p>
        <p>gen {snap.metrics.generationMs.toFixed(0)}ms</p>
        <p>AI {snap.metrics.aiSolveMs.toFixed(0)}ms</p>
        <p>crater {snap.metrics.craterMs.toFixed(1)}ms</p>
      </section>
      <label className="seed">
        Seed
        <input
          value={seedDraft}
          onChange={(e) => setSeedDraft(e.target.value)}
          onBlur={() => {
            if (seedDraft && seedDraft !== snap.seed) onSeed(seedDraft)
          }}
        />
      </label>
      <button type="button" className="ghost solid" onClick={onRegen}>
        Regenerate planet
      </button>
      {sections.map((section) => (
        <div key={section} className="debug-sec">
          <button
            type="button"
            className="sec-h"
            onClick={() => setOpen((s) => ({ ...s, [section]: !s[section] }))}
          >
            {section}
          </button>
          {open[section] !== false &&
            fields
              .filter((f) => f.section === section)
              .map((field) => (
                <label key={field.key} className="tune">
                  <span>
                    {field.label} <i>{TIMING_NOTE[field.timing]}</i>
                  </span>
                  <input
                    type="range"
                    min={field.min}
                    max={field.max}
                    step={field.step}
                    defaultValue={field.value}
                    onChange={(e) => tuning.set(field.key, Number(e.target.value))}
                  />
                  <b>{tuning.get(field.key)}</b>
                </label>
              ))}
        </div>
      ))}
    </aside>
  )
}
