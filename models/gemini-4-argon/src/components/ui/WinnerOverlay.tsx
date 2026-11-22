import React from 'react';
import { Award, RefreshCw, ShieldAlert } from 'lucide-react';
import { PLANET_PRESETS } from '../../simulation/tuning';
import {
  AiDifficulty,
  PlanetPresetId,
  TankState,
  TurnOwner,
} from '../../simulation/types';

interface WinnerOverlayProps {
  winner: TurnOwner;
  tanks: Record<TurnOwner, TankState>;
  turnNumber: number;
  cratersCount: number;
  presetId: PlanetPresetId;
  difficulty: AiDifficulty;
  demoMode?: boolean;
  onNewMatch: () => void;
}

export const WinnerOverlay: React.FC<WinnerOverlayProps> = ({
  winner,
  tanks,
  turnNumber,
  cratersCount,
  presetId,
  difficulty,
  demoMode = false,
  onNewMatch,
}) => {
  const isPlayerVictory = winner === 'player';

  const titleText = demoMode
    ? isPlayerVictory
      ? 'Vanguard-1 Victory!'
      : 'Ares Automaton Victory!'
    : isPlayerVictory
      ? 'Planetary Victory!'
      : 'Tank Destroyed — Defeat';

  const subtitleText = demoMode
    ? isPlayerVictory
      ? 'Vanguard-1 AI zeroed in across the planetary curvature and shattered Ares Automaton.'
      : 'Ares Automaton AI calibrated for wind and gravity to eliminate Vanguard-1.'
    : isPlayerVictory
      ? 'Your ballistic calculation conquered the curvature and shattered the enemy automaton.'
      : 'The AI zeroed in on your coordinates across the horizon.';

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="winner-modal-title"
      data-testid="winner-overlay"
    >
      <div className="modal-card winner-card">
        <div
          className={`winner-card__icon ${demoMode || isPlayerVictory ? 'winner-card__icon--victory' : 'winner-card__icon--defeat'}`}
        >
          {demoMode || isPlayerVictory ? (
            <Award size={40} />
          ) : (
            <ShieldAlert size={40} />
          )}
        </div>

        <h2 id="winner-modal-title" className="winner-card__title">
          {titleText}
        </h2>

        <p className="winner-card__subtitle">{subtitleText}</p>

        <div className="winner-stats">
          <div className="winner-stat">
            <span className="winner-stat__label">Winner Remaining HP</span>
            <span className="winner-stat__value">
              {Math.ceil(tanks[winner].health)} / {tanks[winner].maxHealth} HP
            </span>
          </div>
          <div className="winner-stat">
            <span className="winner-stat__label">Turns Fought</span>
            <span className="winner-stat__value">{turnNumber}</span>
          </div>
          <div className="winner-stat">
            <span className="winner-stat__label">Craters Carved</span>
            <span className="winner-stat__value">{cratersCount}</span>
          </div>
          <div className="winner-stat">
            <span className="winner-stat__label">World &amp; AI Tier</span>
            <span className="winner-stat__value">
              {PLANET_PRESETS[presetId].name} • {difficulty.toUpperCase()}
            </span>
          </div>
        </div>

        <button
          type="button"
          className="primary-btn winner-card__btn"
          onClick={onNewMatch}
          data-testid="new-match-button"
        >
          <RefreshCw size={18} /> New Match (Fresh Planet)
        </button>
      </div>
    </div>
  );
};
