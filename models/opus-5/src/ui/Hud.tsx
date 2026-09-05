import { useGame } from '../state/store';

function Health({ name, value, max, color, align }: { name: string; value: number; max: number; color: string; align?: 'right' }) {
  const fraction = Math.max(0, value) / max;
  return (
    <div className={`panel health${align === 'right' ? ' right' : ''}`}>
      <div className="health-head">
        <span className="health-name" style={{ color }}>
          {name}
        </span>
        <span className="health-value">
          {Math.max(0, Math.round(value))}
          <span style={{ color: 'var(--muted)', fontSize: 11 }}> / {max}</span>
        </span>
      </div>
      <div className="health-track">
        <div
          className="health-fill"
          style={{ width: `${fraction * 100}%`, background: fraction > 0.3 ? color : 'var(--danger)' }}
        />
      </div>
    </div>
  );
}

/** Compass showing where the turret points and which way the wind is pushing. */
function WindCompass({ windBearing, turretBearing, strength }: { windBearing: number; turretBearing: number; strength: number }) {
  return (
    <svg width="46" height="46" viewBox="0 0 46 46" aria-hidden="true">
      <circle cx="23" cy="23" r="19" fill="rgba(0,0,0,0.35)" stroke="var(--line)" />
      <text x="23" y="9" textAnchor="middle" fontSize="7" fill="var(--muted)" fontFamily="var(--mono)">
        N
      </text>
      <g transform={`rotate(${turretBearing} 23 23)`}>
        <path d="M23 8 L26 15 L20 15 Z" fill="var(--player)" opacity="0.9" />
      </g>
      <g transform={`rotate(${windBearing} 23 23)`}>
        <line x1="23" y1="32" x2="23" y2="16" stroke="var(--amber)" strokeWidth="2" strokeLinecap="round" />
        <path d="M23 13 L27 20 L19 20 Z" fill="var(--amber)" />
      </g>
      <circle cx="23" cy="23" r="1.6" fill="var(--muted)" />
      <title>{`Wind ${Math.round(windBearing)}°, strength ${Math.round(strength * 100)}%`}</title>
    </svg>
  );
}

export function Hud() {
  const match = useGame((s) => s.match);
  const phase = useGame((s) => s.phase);
  const playerHealth = useGame((s) => s.playerHealth);
  const aiHealth = useGame((s) => s.aiHealth);
  const wind = useGame((s) => s.wind);
  const bearing = useGame((s) => s.bearing);
  const elevation = useGame((s) => s.elevation);
  const power = useGame((s) => s.power);
  const charging = useGame((s) => s.charging);
  const statusMessage = useGame((s) => s.statusMessage);
  const round = useGame((s) => s.round);
  const muted = useGame((s) => s.muted);
  const showControls = useGame((s) => s.showControls);
  const setPaused = useGame((s) => s.setPaused);
  const setShowControls = useGame((s) => s.setShowControls);
  const toggleMute = useGame((s) => s.toggleMute);

  if (!match) return null;
  const maxHealth = match.tanks.player.maxHealth;
  const lastPower = match.tanks.player.lastPower;
  const yourTurn = phase === 'aim' || phase === 'charging';

  const turnLabel =
    phase === 'aiThink'
      ? 'Enemy ranging'
      : phase === 'flight'
        ? 'Shell in flight'
        : phase === 'impact'
          ? 'Impact'
          : yourTurn
            ? 'Your turn'
            : 'Stand by';

  return (
    <div className="hud">
      <div className="hud-top">
        <div>
          <Health name="Your tank" value={playerHealth} max={maxHealth} color="var(--player)" />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div className={`turn-chip${phase === 'aiThink' || phase === 'flight' ? ' enemy' : ''}`}>
            Round {round} · {turnLabel}
          </div>
          <div className="panel wind">
            <WindCompass windBearing={wind.bearing} turretBearing={bearing} strength={wind.strength} />
            <div className="wind-figures">
              <span className="label">Wind</span>
              <span className="value" style={{ fontSize: 14, color: 'var(--amber)' }}>
                {Math.round(wind.bearing)}° · {(wind.strength * 100).toFixed(0)}%
              </span>
              <div className="wind-strength">
                <span style={{ width: `${wind.strength * 100}%` }} />
              </div>
            </div>
          </div>
        </div>

        <div>
          <Health name="Enemy tank" value={aiHealth} max={maxHealth} color="var(--enemy)" align="right" />
        </div>
      </div>

      <div className="hud-middle">{statusMessage && <div className="status-toast fade-in" key={statusMessage}>{statusMessage}</div>}</div>

      <div className="hud-bottom">
        <div className="readouts">
          <div className="panel readout">
            <span className="label">Bearing</span>
            <span className="value">{bearing.toFixed(1)}°</span>
          </div>
          <div className="panel readout">
            <span className="label">Elevation</span>
            <span className="value">{elevation.toFixed(1)}°</span>
          </div>
        </div>

        <div className="panel power">
          <div className="power-head">
            <span className="label">Power</span>
            <span className="value" style={{ fontSize: 16, color: charging ? 'var(--amber)' : 'var(--text)' }}>
              {power.toFixed(0)}
            </span>
          </div>
          <div className="power-track">
            <div className="power-fill" style={{ width: `${power}%` }} />
            <div className="power-marker" style={{ left: `${lastPower}%` }} title="Last shot" />
          </div>
          <div className="power-hint">
            {charging ? 'Release Space to fire' : yourTurn ? 'Hold Space to charge · Arrows to aim' : turnLabel}
          </div>
        </div>

        <div className="hud-right">
          <div className="icon-row">
            <button className="icon-btn" onClick={toggleMute} title={muted ? 'Unmute (M)' : 'Mute (M)'}>
              {muted ? '🔇' : '🔊'}
            </button>
            <button className="icon-btn" onClick={() => setPaused(true)} title="Pause (Esc)">
              ⏸
            </button>
          </div>
          {showControls ? (
            <div className="panel hints">
              <button className="hints-dismiss" onClick={() => setShowControls(false)} title="Hide controls">
                ×
              </button>
              <div>
                <kbd>←</kbd> <kbd>→</kbd> bearing · <kbd>↑</kbd> <kbd>↓</kbd> elevation
              </div>
              <div>
                <kbd>Space</kbd> hold to charge, release to fire
              </div>
              <div>Drag to orbit · Shift-drag to pan · Scroll to zoom</div>
            </div>
          ) : (
            <button className="icon-btn" onClick={() => setShowControls(true)} title="Show controls">
              ?
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
