import { PRESETS } from '../sim/presets'
import { useStore } from '../state/store'

export function Loading() {
  const loading = useStore((s) => s.loading)
  const seed = useStore((s) => s.seed)
  const preset = useStore((s) => s.settings.preset)
  const pct = Math.round(loading.progress * 100)
  return (
    <div className="screen loading">
      <div className="loading-card">
        <span className={`orb big orb-${preset}`} style={{ ['--p' as string]: `${pct}%` }} />
        <div className="loading-title">Forming {PRESETS[preset].name.toLowerCase()} world</div>
        <div className="loading-sub">{loading.label || 'Preparing'} · world “{seed}”</div>
        <div className="bar">
          <div className="bar-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="loading-pct">{pct}%</div>
      </div>
    </div>
  )
}
