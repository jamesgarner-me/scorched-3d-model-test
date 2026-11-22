import React from 'react';
import { PLANET_PRESETS } from '../../simulation/tuning';
import { PlanetPresetId } from '../../simulation/types';

interface LoadingScreenProps {
  progress: number;
  stageLabel: string;
  presetId: PlanetPresetId;
  seed: string;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  progress,
  stageLabel,
  presetId,
  seed,
}) => {
  const preset = PLANET_PRESETS[presetId];
  const pct = Math.min(100, Math.max(0, Math.round(progress)));

  return (
    <div
      className="loading-overlay"
      role="status"
      aria-live="polite"
      aria-label="Generating planetary battlefield"
    >
      <div className="loading-card">
        <div className="loading-card__badge">{preset.name} Preset</div>
        <h1 className="loading-card__title">Planetary Artillery</h1>
        <p className="loading-card__subtitle">{preset.tagline}</p>

        <div className="loading-progress">
          <div className="loading-progress__header">
            <span className="loading-progress__stage">{stageLabel}</span>
            <span className="loading-progress__pct">{pct}%</span>
          </div>
          <div
            className="loading-progress__track"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="loading-progress__fill" style={{ width: `${pct}%` }} />
          </div>
        </div>

        <div className="loading-card__meta">
          <span>Seed: {seed}</span>
          <span>Spherical Gravity &amp; Persistent Craters</span>
        </div>
      </div>
    </div>
  );
};
