import React from 'react';
import { Play, RefreshCw, Volume2, VolumeX } from 'lucide-react';
import { AiDifficulty, PlanetPresetId } from '../../simulation/types';

interface PauseModalProps {
  muted: boolean;
  volume: number;
  presetId: PlanetPresetId;
  difficulty: AiDifficulty;
  onToggleMute: () => void;
  onChangeVolume: (v: number) => void;
  onSelectPreset: (preset: PlanetPresetId) => void;
  onSelectDifficulty: (diff: AiDifficulty) => void;
  onResume: () => void;
  onNewMatch: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  muted,
  volume,
  presetId,
  difficulty,
  onToggleMute,
  onChangeVolume,
  onSelectPreset,
  onSelectDifficulty,
  onResume,
  onNewMatch,
}) => {
  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pause-modal-title"
      data-testid="pause-modal"
    >
      <div className="modal-card">
        <h2 id="pause-modal-title" className="modal-card__title">
          Paused &amp; Match Settings
        </h2>

        <div className="settings-list">
          <div className="settings-row">
            <span>Sound Effects</span>
            <button type="button" className="secondary-btn" onClick={onToggleMute}>
              {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              {muted ? 'Muted' : 'Enabled'}
            </button>
          </div>

          <div className="settings-row">
            <label htmlFor="volume-slider">Master Volume</label>
            <input
              id="volume-slider"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              disabled={muted}
              onChange={(e) => onChangeVolume(parseFloat(e.target.value))}
            />
          </div>

          <div className="settings-row">
            <label htmlFor="pause-preset-select">Planet Preset</label>
            <select
              id="pause-preset-select"
              className="hud-select"
              value={presetId}
              onChange={(e) => onSelectPreset(e.target.value as PlanetPresetId)}
            >
              <option value="earth">Earth-like (Water + Clouds)</option>
              <option value="mars">Mars-like (Rust + Low Gravity)</option>
            </select>
          </div>

          <div className="settings-row">
            <label htmlFor="pause-difficulty-select">AI Difficulty</label>
            <select
              id="pause-difficulty-select"
              className="hud-select"
              value={difficulty}
              onChange={(e) => onSelectDifficulty(e.target.value as AiDifficulty)}
            >
              <option value="easy">Easy (Wide scatter)</option>
              <option value="medium">Medium (Walks shots in)</option>
              <option value="hard">Hard (Precise wind &amp; gravity solver)</option>
            </select>
          </div>
        </div>

        <div className="modal-actions">
          <button type="button" className="secondary-btn" onClick={onNewMatch}>
            <RefreshCw size={16} /> New Match
          </button>
          <button type="button" className="primary-btn" onClick={onResume}>
            <Play size={16} /> Resume Duel
          </button>
        </div>
      </div>
    </div>
  );
};
