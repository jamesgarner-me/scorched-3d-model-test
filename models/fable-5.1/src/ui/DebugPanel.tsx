import { useState, useSyncExternalStore } from 'react'
import { length } from '../sim/vec'
import { getTuningVersion, setTuning, subscribeTuning, TUNING, tuningGroups, type TuningEffect, type TuningKey } from '../sim/tuning'
import { game } from '../state/game'
import { useStore } from '../state/store'

const EFFECT_LABEL: Record<TuningEffect, string> = { live: 'live', 'next-shot': 'next shot', regenerate: 'regenerate', 'new-match': 'new match' }

const useTuningVersion = () => useSyncExternalStore(subscribeTuning, getTuningVersion, getTuningVersion)

export function DebugPanel() {
  useTuningVersion()
  const [, bump] = useState(0)
  const metrics = useStore((s) => s.metrics)
  const seed = useStore((s) => s.seed)
  const match = useStore((s) => s.match)
  const [seedInput, setSeedInput] = useState(seed)
  const rerender = () => bump((n) => n + 1)
  return (
    <aside className="debug">
      <div className="debug-head">
        <span>Debug</span>
        <button className="icon-btn" onClick={() => game.toggleDebug()} aria-label="Close debug">×</button>
      </div>
      <details open>
        <summary>Performance</summary>
        <table className="kv">
          <tbody>
            <tr><td>FPS</td><td className="mono">{metrics.fps}</td></tr>
            <tr><td>Frame time</td><td className="mono">{metrics.frameMs} ms</td></tr>
            <tr><td>Generation</td><td className="mono">{Math.round(metrics.genMs)} ms</td></tr>
            <tr><td>AI solve</td><td className="mono">{Math.round(metrics.aiMs)} ms · {metrics.aiEvals} sims</td></tr>
            <tr><td>Crater update</td><td className="mono">{metrics.carveMs.toFixed(1)} ms</td></tr>
          </tbody>
        </table>
      </details>
      <details open>
        <summary>Seed</summary>
        <div className="seed-row">
          <input value={seedInput} onChange={(e) => setSeedInput(e.target.value)} spellCheck={false} />
          <button onClick={() => game.regenerate(seedInput.trim() || undefined)}>Regenerate</button>
        </div>
        {match && (
          <table className="kv">
            <tbody>
              <tr><td>Radius</td><td className="mono">{match.planet.radius}</td></tr>
              <tr><td>Heights</td><td className="mono">{match.planet.minHeight.toFixed(1)} … {match.planet.maxHeight.toFixed(1)}</td></tr>
              <tr><td>Craters</td><td className="mono">{match.planet.craters.length}</td></tr>
              <tr><td>Wind</td><td className="mono">{match.windStrength.toFixed(2)}</td></tr>
              <tr><td>AI belief error</td><td className="mono">{length(match.ai.aimOffset).toFixed(1)} m · turn {match.ai.turns}</td></tr>
            </tbody>
          </table>
        )}
      </details>
      {tuningGroups().map((group) => (
        <details key={group}>
          <summary>{group}</summary>
          {(Object.keys(TUNING) as TuningKey[]).filter((k) => TUNING[k].group === group).map((k) => {
            const d = TUNING[k]
            return (
              <label key={k} className="tune-row">
                <span className="tune-label">{d.label}</span>
                <span className={`tag ${d.effect}`}>{EFFECT_LABEL[d.effect]}</span>
                <input type="number" value={Number(d.value.toFixed(4))} min={d.min} max={d.max} step={d.step} onChange={(e) => { setTuning(k, Number(e.target.value)); rerender() }} />
              </label>
            )
          })}
        </details>
      ))}
      <div className="button-row">
        <button onClick={() => game.regenerate()}>Regenerate planet</button>
        <button onClick={() => game.newMatch()}>New match</button>
      </div>
    </aside>
  )
}
