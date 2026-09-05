import { RAD, toLocalTangent } from '../sim/vec'
import { game } from '../state/game'
import { useStore, type Phase } from '../state/store'

const TURN_TEXT: Partial<Record<Phase, string>> = {
  aim: 'Your turn',
  flight: 'Shot in flight',
  impact: 'Impact',
  'ai-think': 'Enemy is thinking…',
  'ai-aim': 'Enemy is aiming',
  destroy: 'Destroyed',
}

function HealthBar({ label, value, max, side }: { label: string; value: number; max: number; side: 'left' | 'right' }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <div className={`health ${side}`}>
      <div className="health-label">
        <span>{label}</span>
        <span className="mono">{value}</span>
      </div>
      <div className="health-track">
        <div className={`health-fill ${pct < 30 ? 'low' : ''}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function WindCompass() {
  const match = useStore((s) => s.match)
  const bearing = useStore((s) => s.aim.bearing)
  if (!match) return null
  const frame = match.tanks.player.frame
  const local = toLocalTangent(frame, match.wind)
  const strength = Math.sqrt(local.east ** 2 + local.north ** 2)
  const angle = Math.atan2(local.east, local.north) * RAD
  const shown = Math.round(strength * 30)
  return (
    <div className="wind">
      <div className="compass">
        <span className="compass-n">N</span>
        <div className="bearing-tick" style={{ transform: `rotate(${bearing * RAD}deg)` }} />
        <div className="wind-arrow" style={{ transform: `rotate(${angle}deg)`, opacity: 0.35 + Math.min(1, strength / 1.2) * 0.65 }}>
          <span>➤</span>
        </div>
      </div>
      <div className="wind-text">
        <span className="wind-label">Wind</span>
        <span className="mono wind-value">{shown}</span>
      </div>
    </div>
  )
}

export function Hud() {
  const phase = useStore((s) => s.phase)
  const health = useStore((s) => s.health)
  const maxHealth = useStore((s) => s.maxHealth)
  const aim = useStore((s) => s.aim)
  const charging = useStore((s) => s.charging)
  const message = useStore((s) => s.message)
  const turn = useStore((s) => s.turn)
  const paused = useStore((s) => s.paused)
  const bearingDeg = ((Math.round(aim.bearing * RAD) % 360) + 360) % 360
  const elevationDeg = Math.round(aim.elevation * RAD)
  const power = Math.round(aim.power * 100)
  const yourTurn = phase === 'aim'
  return (
    <div className="hud">
      <div className="hud-top">
        <HealthBar label="You" value={health.player} max={maxHealth} side="left" />
        <div className="turn-banner-wrap">
          <div className={`turn-banner ${turn === 'player' ? 'you' : 'enemy'} ${yourTurn ? 'pulse' : ''}`}>{TURN_TEXT[phase] ?? ''}</div>
          <WindCompass />
        </div>
        <HealthBar label="Enemy" value={health.ai} max={maxHealth} side="right" />
      </div>

      {message && (
        <div key={message.id} className={`toast ${message.tone}`}>
          <div className="toast-text">{message.text}</div>
          {message.sub && <div className="toast-sub">{message.sub}</div>}
        </div>
      )}

      <div className="hud-bottom">
        <div className="readout">
          <div className="readout-item">
            <span className="readout-label">Bearing</span>
            <span className="mono readout-value">{bearingDeg.toString().padStart(3, '0')}°</span>
          </div>
          <div className="readout-item">
            <span className="readout-label">Elevation</span>
            <span className="mono readout-value">{elevationDeg.toString().padStart(2, '0')}°</span>
          </div>
          <div className="readout-item power">
            <span className="readout-label">Power</span>
            <div className="power-track">
              <div className={`power-fill ${charging ? 'charging' : ''}`} style={{ width: `${power}%` }} />
            </div>
            <span className="mono readout-value">{power}%</span>
          </div>
        </div>
        <div className="hint">
          {yourTurn ? (charging ? 'Release Space to fire' : 'Arrows aim · hold Space to charge') : phase === 'flight' ? 'Watching the shot…' : phase.startsWith('ai') ? 'Orbit the camera while the enemy aims' : ''}
        </div>
      </div>

      <button className="icon-btn pause-btn" onClick={() => game.togglePause()} title="Pause (Esc)" aria-label="Pause">
        {paused ? '▶' : '❚❚'}
      </button>
    </div>
  )
}
