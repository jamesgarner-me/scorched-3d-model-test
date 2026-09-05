import { DIFFICULTIES, type Difficulty } from '../game/ai';
import { PRESETS, PRESET_IDS } from '../game/presets';
import { useGame } from '../state/store';

export function StartMenu() {
  const preset = useGame((s) => s.preset);
  const difficulty = useGame((s) => s.difficulty);
  const seedInput = useGame((s) => s.seedInput);
  const setPreset = useGame((s) => s.setPreset);
  const setDifficulty = useGame((s) => s.setDifficulty);
  const setSeedInput = useGame((s) => s.setSeedInput);
  const startMatch = useGame((s) => s.startMatch);

  return (
    <div className="overlay">
      <div className="overlay-card fade-in">
        <h1 className="title">Planetary Artillery</h1>
        <p className="subtitle">
          A turn-based duel on a small, procedurally generated world. Gravity pulls towards the planet's
          centre, wind bends every shell, and the craters you carve stay carved. You shoot first.
        </p>

        <span className="label">World</span>
        <div className="choice-grid" style={{ marginTop: 8 }}>
          {PRESET_IDS.map((id) => (
            <button
              key={id}
              className="choice"
              aria-pressed={preset === id}
              onClick={() => setPreset(id)}
            >
              <div className="choice-name">{PRESETS[id].name}</div>
              <div className="choice-blurb">{PRESETS[id].blurb}</div>
            </button>
          ))}
        </div>

        <span className="label">Opponent</span>
        <div className="choice-grid three" style={{ marginTop: 8 }}>
          {DIFFICULTIES.map((d) => (
            <button
              key={d.id}
              className="choice"
              aria-pressed={difficulty === d.id}
              onClick={() => setDifficulty(d.id as Difficulty)}
            >
              <div className="choice-name">{d.name}</div>
              <div className="choice-blurb">{d.blurb}</div>
            </button>
          ))}
        </div>

        <span className="label">Seed (optional)</span>
        <div className="field-row" style={{ marginTop: 8 }}>
          <input
            type="text"
            value={seedInput}
            placeholder="leave blank for a random world"
            maxLength={16}
            onChange={(e) => setSeedInput(e.target.value.toUpperCase())}
          />
        </div>

        <div className="actions">
          <button className="btn primary" onClick={() => void startMatch()}>
            Start match
          </button>
        </div>

        <div className="keyhint-list">
          <kbd>← →</kbd>
          <span>Turret bearing</span>
          <kbd>↑ ↓</kbd>
          <span>Cannon elevation</span>
          <kbd>Space</kbd>
          <span>Hold to charge power, release to fire</span>
          <kbd>Drag / Scroll</kbd>
          <span>Orbit and zoom the camera</span>
          <kbd>Esc</kbd>
          <span>Pause</span>
        </div>
      </div>
    </div>
  );
}

export function LoadingScreen() {
  const progress = useGame((s) => s.progress);
  const preset = useGame((s) => s.preset);
  return (
    <div className="overlay">
      <div className="overlay-card fade-in" style={{ textAlign: 'center', maxWidth: 420 }}>
        <div className="spinner" />
        <h2 className="title" style={{ fontSize: 20 }}>
          Generating {PRESETS[preset].name}
        </h2>
        <p className="subtitle" style={{ marginBottom: 0 }}>
          Carving continents, filling oceans and finding two places worth fighting over.
        </p>
        <div className="loading-bar">
          <div className="loading-fill" style={{ width: `${Math.round(progress.fraction * 100)}%` }} />
        </div>
        <div className="loading-status">
          <span>{progress.label}</span>
          <span>{Math.round(progress.fraction * 100)}%</span>
        </div>
      </div>
    </div>
  );
}

export function FlyoverOverlay() {
  const skipFlyover = useGame((s) => s.skipFlyover);
  const statusMessage = useGame((s) => s.statusMessage);
  return (
    <div
      className="hud"
      style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 32 }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <div className="status-toast">{statusMessage}</div>
        <button className="btn ghost" style={{ pointerEvents: 'auto' }} onClick={skipFlyover}>
          Skip flyover (Space)
        </button>
      </div>
    </div>
  );
}

export function PauseMenu() {
  const setPaused = useGame((s) => s.setPaused);
  const startMatch = useGame((s) => s.startMatch);
  const returnToMenu = useGame((s) => s.returnToMenu);
  const muted = useGame((s) => s.muted);
  const toggleMute = useGame((s) => s.toggleMute);
  const match = useGame((s) => s.match);

  return (
    <div className="overlay">
      <div className="overlay-card fade-in" style={{ maxWidth: 420 }}>
        <h2 className="title" style={{ fontSize: 22 }}>
          Paused
        </h2>
        <p className="subtitle">
          {match ? `${match.planet.preset.name} · radius ${match.planet.radius} · seed ${match.seed}` : ''}
        </p>
        <div className="choice-grid" style={{ gridTemplateColumns: '1fr' }}>
          <button className="choice" aria-pressed={!muted} onClick={toggleMute}>
            <div className="choice-name">Sound: {muted ? 'off' : 'on'}</div>
            <div className="choice-blurb">Toggle firing, flight and impact audio (M).</div>
          </button>
        </div>
        <div className="actions">
          <button className="btn primary" onClick={() => setPaused(false)}>
            Resume
          </button>
          <button
            className="btn"
            onClick={() => {
              setPaused(false);
              void startMatch({ seed: '' });
            }}
          >
            New match
          </button>
          <button className="btn ghost" onClick={returnToMenu}>
            Main menu
          </button>
        </div>
      </div>
    </div>
  );
}

export function WinnerOverlay() {
  const match = useGame((s) => s.match);
  const winner = useGame((s) => s.winner);
  const round = useGame((s) => s.round);
  const startMatch = useGame((s) => s.startMatch);
  const returnToMenu = useGame((s) => s.returnToMenu);
  if (!match) return null;

  const playerWon = winner === 'player';
  return (
    <div className="overlay">
      <div className="overlay-card fade-in" style={{ maxWidth: 480 }}>
        <div className="winner-tag">Match over</div>
        <h2 className={`winner-title ${playerWon ? 'win' : 'loss'}`}>{playerWon ? 'Victory' : 'Defeat'}</h2>
        <p className="subtitle" style={{ marginTop: -6 }}>
          {playerWon
            ? 'The enemy tank is a smoking crater. The planet keeps the scars.'
            : 'Your tank is gone. The enemy read the wind better than you did.'}
        </p>

        <div className="stat-grid">
          <div className="stat">
            <span className="label">Rounds</span>
            <span className="value">{round}</span>
          </div>
          <div className="stat">
            <span className="label">Craters</span>
            <span className="value">{match.planet.craterCount}</span>
          </div>
          <div className="stat">
            <span className="label">Winner HP</span>
            <span className="value">{Math.max(match.tanks.player.health, match.tanks.ai.health)}</span>
          </div>
        </div>

        <div className="actions">
          <button className="btn primary" onClick={() => void startMatch({ seed: '' })}>
            New match
          </button>
          <button className="btn ghost" onClick={returnToMenu}>
            Main menu
          </button>
        </div>
        <div className="loading-status" style={{ marginTop: 18 }}>
          <span>
            {match.planet.preset.name} · {match.difficulty} · seed {match.seed}
          </span>
        </div>
      </div>
    </div>
  );
}
