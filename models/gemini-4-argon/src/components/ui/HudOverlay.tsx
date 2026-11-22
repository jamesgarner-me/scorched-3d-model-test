import React from 'react';
import {
  Compass,
  Crosshair,
  Flame,
  Pause,
  RotateCcw,
  Sliders,
  Wind,
} from 'lucide-react';
import { PLANET_PRESETS } from '../../simulation/tuning';
import {
  AiDifficulty,
  GamePhase,
  PlanetPresetId,
  TankState,
  TurnOwner,
  WindVector,
} from '../../simulation/types';

interface HudOverlayProps {
  tanks: Record<TurnOwner, TankState>;
  currentTurn: TurnOwner;
  turnNumber: number;
  phase: GamePhase;
  presetId: PlanetPresetId;
  difficulty: AiDifficulty;
  wind: WindVector;
  planetRadius: number;
  cratersCount: number;
  chargingPower: number | null;
  damageBanner: string | null;
  debugOpen: boolean;
  onSelectPreset: (preset: PlanetPresetId) => void;
  onSelectDifficulty: (diff: AiDifficulty) => void;
  onAdjustAim: (dBearing: number, dElevation: number) => void;
  onStartCharge: () => void;
  onReleaseCharge: () => void;
  onSkipFlyover: () => void;
  onFocusPlayerCamera: () => void;
  onOpenPause: () => void;
  onToggleDebug: () => void;
}

function compassLabel(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const idx = Math.round((((deg % 360) + 360) % 360) / 45) % 8;
  return dirs[idx];
}

export const HudOverlay: React.FC<HudOverlayProps> = ({
  tanks,
  currentTurn,
  turnNumber,
  phase,
  presetId,
  difficulty,
  wind,
  planetRadius,
  cratersCount,
  chargingPower,
  damageBanner,
  debugOpen,
  onSelectPreset,
  onSelectDifficulty,
  onAdjustAim,
  onStartCharge,
  onReleaseCharge,
  onSkipFlyover,
  onFocusPlayerCamera,
  onOpenPause,
  onToggleDebug,
}) => {
  const player = tanks.player;
  const ai = tanks.ai;
  const playerHpPct = Math.max(
    0,
    Math.min(100, (player.health / player.maxHealth) * 100),
  );
  const aiHpPct = Math.max(0, Math.min(100, (ai.health / ai.maxHealth) * 100));

  const isPlayerInteractive =
    currentTurn === 'player' && (phase === 'aiming' || phase === 'charging');

  const displayPower = chargingPower !== null ? chargingPower : player.lastPower;

  const getTurnStatusText = (): string => {
    if (phase === 'flyover') {
      return 'ORBITAL RECONNAISSANCE — SURVEYING PLANET';
    }
    if (phase === 'flight') {
      return 'SHELL IN FLIGHT — TRACKING BALLISTIC ARC';
    }
    if (phase === 'impact') {
      return 'IMPACT DETONATION';
    }
    if (phase === 'destruction') {
      return 'CRITICAL TARGET DESTRUCTION!';
    }
    if (currentTurn === 'ai') {
      return 'AI OPPONENT AIMING — CAMERA ORBIT ACTIVE';
    }
    if (phase === 'charging') {
      return 'CHARGING CANNON — RELEASE SPACE TO FIRE!';
    }
    return 'YOUR TURN — AIM WITH ARROWS, HOLD SPACE TO FIRE';
  };

  return (
    <div className="hud-layer">
      {/* Top Bar: Health, Turn Status, Environment & Controls */}
      <header className="hud-top">
        {/* Player Health Card */}
        <div
          className={`tank-card tank-card--player ${currentTurn === 'player' ? 'tank-card--active' : ''}`}
          data-testid="player-health-card"
        >
          <div className="tank-card__header">
            <span className="tank-card__name">{player.name}</span>
            <span className="tank-card__hp-value" data-testid="player-hp-text">
              {Math.ceil(player.health)} / {player.maxHealth} HP
            </span>
          </div>
          <div className="health-bar">
            <div
              className="health-bar__fill health-bar__fill--player"
              style={{ width: `${playerHpPct}%` }}
            />
          </div>
        </div>

        {/* Central Turn & Environment Telemetry */}
        <div className="hud-center-status">
          <div
            className={`turn-banner turn-banner--${currentTurn}`}
            data-testid="turn-indicator"
          >
            <span className="turn-banner__round">TURN {turnNumber}</span>
            <span className="turn-banner__text">{getTurnStatusText()}</span>
          </div>

          <div className="env-strip">
            {/* Wind Widget */}
            <div
              className="env-pill"
              data-testid="wind-readout"
              title="Current tangential wind"
            >
              <Wind size={15} className="env-pill__icon" />
              <span>
                Wind: <strong>{wind.strength.toFixed(1)} m/s</strong>{' '}
                {compassLabel(wind.directionDeg)} ({wind.directionDeg}°)
              </span>
              <span
                className="wind-arrow"
                style={{ transform: `rotate(${wind.directionDeg}deg)` }}
                aria-hidden="true"
              >
                ↑
              </span>
            </div>

            {/* Planet Info Pill */}
            <div className="env-pill">
              <Compass size={15} className="env-pill__icon" />
              <span>
                {PLANET_PRESETS[presetId].name} • R={planetRadius.toFixed(1)}m •{' '}
                <strong data-testid="craters-count">{cratersCount}</strong> craters
              </span>
            </div>
          </div>
        </div>

        {/* AI Health Card & Utility Actions */}
        <div className="hud-right-group">
          <div
            className={`tank-card tank-card--ai ${currentTurn === 'ai' ? 'tank-card--active' : ''}`}
            data-testid="ai-health-card"
          >
            <div className="tank-card__header">
              <span className="tank-card__name">{ai.name}</span>
              <span className="tank-card__hp-value" data-testid="ai-hp-text">
                {Math.ceil(ai.health)} / {ai.maxHealth} HP
              </span>
            </div>
            <div className="health-bar">
              <div
                className="health-bar__fill health-bar__fill--ai"
                style={{ width: `${aiHpPct}%` }}
              />
            </div>
          </div>

          <div className="hud-toolbar">
            <label className="hud-select-label" htmlFor="preset-select">
              World
              <select
                id="preset-select"
                aria-label="Planet Preset"
                className="hud-select"
                value={presetId}
                onChange={(e) => onSelectPreset(e.target.value as PlanetPresetId)}
              >
                <option value="earth">Earth-like</option>
                <option value="mars">Mars-like</option>
              </select>
            </label>

            <label className="hud-select-label" htmlFor="difficulty-select">
              AI Tier
              <select
                id="difficulty-select"
                aria-label="AI Difficulty"
                className="hud-select"
                value={difficulty}
                onChange={(e) => onSelectDifficulty(e.target.value as AiDifficulty)}
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </label>

            <button
              type="button"
              className="icon-btn"
              onClick={onFocusPlayerCamera}
              title="Reset camera behind your tank (C)"
              aria-label="Focus Camera on Tank"
            >
              <RotateCcw size={16} />
            </button>

            <button
              type="button"
              className={`icon-btn ${debugOpen ? 'icon-btn--active' : ''}`}
              onClick={onToggleDebug}
              title="Toggle Developer Debug & Tuning Panel (`)"
              aria-label="Toggle Debug Panel"
            >
              <Sliders size={16} />
            </button>

            <button
              type="button"
              className="icon-btn"
              onClick={onOpenPause}
              title="Pause & Settings (Esc)"
              aria-label="Pause Game"
            >
              <Pause size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* Flyover Skip Prompt */}
      {phase === 'flyover' && (
        <div className="flyover-prompt">
          <button type="button" className="primary-btn" onClick={onSkipFlyover}>
            Skip Flyover &amp; Begin Turn (Space)
          </button>
        </div>
      )}

      {/* Concise Damage & Impact Readout Banner (User Story 40) */}
      {damageBanner && (
        <div
          className="damage-readout"
          role="status"
          aria-live="polite"
          data-testid="damage-readout"
        >
          {damageBanner}
        </div>
      )}

      {/* Bottom Aiming & Power Control Dock */}
      <footer className="hud-bottom">
        <div className="aim-panel" data-testid="aim-readout">
          <div className="aim-stat">
            <span className="aim-stat__label">
              <Crosshair size={14} /> Bearing (←/→)
            </span>
            <div className="aim-stat__controls">
              <button
                type="button"
                className="step-btn"
                disabled={!isPlayerInteractive}
                onClick={() => onAdjustAim(-2, 0)}
                aria-label="Decrease Bearing"
              >
                −
              </button>
              <span className="aim-stat__value" data-testid="bearing-value">
                {Math.round(player.bearingDeg)}°
              </span>
              <button
                type="button"
                className="step-btn"
                disabled={!isPlayerInteractive}
                onClick={() => onAdjustAim(2, 0)}
                aria-label="Increase Bearing"
              >
                +
              </button>
            </div>
          </div>

          <div className="aim-stat">
            <span className="aim-stat__label">Elevation (↓/↑)</span>
            <div className="aim-stat__controls">
              <button
                type="button"
                className="step-btn"
                disabled={!isPlayerInteractive}
                onClick={() => onAdjustAim(0, -2)}
                aria-label="Decrease Elevation"
              >
                −
              </button>
              <span className="aim-stat__value" data-testid="elevation-value">
                {Math.round(player.elevationDeg)}°
              </span>
              <button
                type="button"
                className="step-btn"
                disabled={!isPlayerInteractive}
                onClick={() => onAdjustAim(0, 2)}
                aria-label="Increase Elevation"
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* Power Charge Meter & Hold-Space Fire Trigger */}
        <div className="power-panel">
          <div className="power-meter__header">
            <span className="power-meter__label">
              <Flame size={15} /> Cannon Power{' '}
              {chargingPower !== null ? '(CHARGING...)' : '(Baseline / Last Shot)'}
            </span>
            <span className="power-meter__value" data-testid="power-value">
              {Math.round(displayPower)}%
            </span>
          </div>

          <div
            className="power-meter__track"
            role="meter"
            aria-label="Shot Power"
            aria-valuenow={Math.round(displayPower)}
            aria-valuemin={10}
            aria-valuemax={100}
          >
            <div
              className={`power-meter__fill ${chargingPower !== null ? 'power-meter__fill--charging' : ''}`}
              style={{ width: `${displayPower}%` }}
            />
            <div
              className="power-meter__marker"
              style={{ left: `${player.lastPower}%` }}
              title={`Last shot power: ${Math.round(player.lastPower)}%`}
            />
          </div>

          <div className="controls-hint">
            <span>
              <strong>← / →</strong> Bearing • <strong>↑ / ↓</strong> Elevation •{' '}
              <strong>Hold Space</strong> Charge &amp; Release to Fire •{' '}
              <strong>Drag Mouse</strong> Orbit Camera
            </span>
          </div>
        </div>

        <div className="fire-action">
          <button
            type="button"
            className={`fire-btn ${phase === 'charging' ? 'fire-btn--charging' : ''}`}
            disabled={!isPlayerInteractive}
            onMouseDown={onStartCharge}
            onMouseUp={onReleaseCharge}
            onMouseLeave={() => {
              if (phase === 'charging') {
                onReleaseCharge();
              }
            }}
            data-testid="fire-button"
          >
            {phase === 'charging' ? 'RELEASE TO FIRE!' : 'HOLD SPACE / CLICK'}
          </button>
        </div>
      </footer>
    </div>
  );
};
