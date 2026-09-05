import { deg } from '../game/math.ts'
import type { Snapshot } from '../game/match.ts'

export function HUD({
  snap,
  onPause,
  onDebug,
}: {
  snap: Snapshot
  onPause: () => void
  onDebug: () => void
}) {
  const turnLabel =
    snap.phase === 'aiThinking'
      ? 'AI aligning'
      : snap.phase === 'inFlight'
        ? 'Round in flight'
        : snap.phase === 'playerTurn' || snap.phase === 'charging'
          ? 'Your battery'
          : snap.phase === 'flyover'
            ? 'Approach'
            : snap.phase === 'destruction'
              ? 'Impact'
              : 'Hold'

  return (
    <div className="hud">
      <header className="hud-top">
        <div className="plate">
          <span className="kicker">Turn</span>
          <strong>{turnLabel}</strong>
        </div>
        <div className="plate wind">
          <span className="kicker">Wind</span>
          <strong>
            {snap.windStrength.toFixed(1)}
            <small>u</small>
          </strong>
          <span className="compass" style={{ transform: `rotate(${deg(snap.windBearing)}deg)` }}>
            ↑
          </span>
        </div>
        <div className="hud-actions">
          <button type="button" onClick={onDebug} className="ghost">
            DBG
          </button>
          <button type="button" onClick={onPause} className="ghost">
            Halt
          </button>
        </div>
      </header>

      <div className="hp-row">
        <Hp side="You" current={snap.player.health} max={snap.player.maxHealth} tone="player" />
        <Hp side="AI" current={snap.enemy.health} max={snap.enemy.maxHealth} tone="ai" />
      </div>

      {(snap.phase === 'playerTurn' || snap.phase === 'charging') && (
        <footer className="aim">
          <div className="readout">
            <span>BRG {deg(snap.bearing).toFixed(1)}°</span>
            <span>ELV {deg(snap.elevation).toFixed(1)}°</span>
          </div>
          <div className="power">
            <div className="power-fill" style={{ width: `${(snap.charging ? snap.power : snap.lastPower) * 100}%` }} />
            <span>{Math.round((snap.charging ? snap.power : snap.lastPower) * 100)} pwr</span>
          </div>
          <p className="controls-hint">←→ bearing · ↑↓ elevation · hold space · release to fire</p>
        </footer>
      )}

      {snap.lastDamage && snap.phase === 'resolving' && (
        <div className="damage">
          {snap.lastDamage.amount} dmg · {snap.lastDamage.side === 'player' ? 'your hull' : 'AI hull'}
        </div>
      )}
    </div>
  )
}

function Hp({
  side,
  current,
  max,
  tone,
}: {
  side: string
  current: number
  max: number
  tone: 'player' | 'ai'
}) {
  const pct = Math.max(0, (current / max) * 100)
  return (
    <div className={`hp ${tone}`}>
      <div className="hp-meta">
        <span>{side}</span>
        <b>
          {Math.round(current)} / {max}
        </b>
      </div>
      <div className="hp-bar">
        <span style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
