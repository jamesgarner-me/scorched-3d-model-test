import React, { useState } from 'react';
import { ChevronDown, ChevronRight, RefreshCw, RotateCcw } from 'lucide-react';
import { DEFAULT_TUNING, TUNING_FIELDS, TuningConfig } from '../../simulation/tuning';
import { PerformanceMetrics } from '../../simulation/types';

interface DebugPanelProps {
  seed: string;
  tuning: TuningConfig;
  metrics: PerformanceMetrics;
  needsRegenerate: boolean;
  onUpdateTuning: <K extends keyof TuningConfig>(
    key: K,
    value: TuningConfig[K],
  ) => void;
  onResetTuning: () => void;
  onApplySeedAndRegenerate: (customSeed: string) => void;
}

const SECTIONS = [
  'Seed & Regeneration',
  'Performance Telemetry',
  'Planet Generation',
  'Physics & Wind',
  'Trajectory Guide',
  'Combat & Craters',
] as const;

export const DebugPanel: React.FC<DebugPanelProps> = ({
  seed,
  tuning,
  metrics,
  needsRegenerate,
  onUpdateTuning,
  onResetTuning,
  onApplySeedAndRegenerate,
}) => {
  const [seedInput, setSeedInput] = useState(seed);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    'Seed & Regeneration': true,
    'Performance Telemetry': true,
    'Planet Generation': false,
    'Physics & Wind': true,
    'Trajectory Guide': false,
    'Combat & Craters': false,
  });

  // Keep seedInput synced when external seed changes
  React.useEffect(() => {
    setSeedInput(seed);
  }, [seed]);

  const toggleSection = (sec: string): void => {
    setOpenSections((prev) => ({ ...prev, [sec]: !prev[sec] }));
  };

  return (
    <aside
      className="debug-panel"
      aria-label="Developer Debug and Tuning Panel"
      data-testid="debug-panel"
    >
      <div className="debug-panel__header">
        <div>
          <h3 className="debug-panel__title">TuningRegistry &amp; Telemetry</h3>
          <span className="debug-panel__subtitle">
            Live parameter classification &amp; deterministic seed control
          </span>
        </div>
        <button
          type="button"
          className="step-btn"
          onClick={onResetTuning}
          title="Reset all tuning values to defaults"
        >
          <RotateCcw size={13} />
        </button>
      </div>

      {/* Collapsible Section: Seed & Regeneration */}
      <div className="debug-section">
        <button
          type="button"
          className="debug-section__toggle"
          onClick={() => toggleSection('Seed & Regeneration')}
        >
          {openSections['Seed & Regeneration'] ? (
            <ChevronDown size={14} />
          ) : (
            <ChevronRight size={14} />
          )}
          <span>Seed &amp; Regeneration</span>
          {needsRegenerate && (
            <span className="badge badge--regenerate">Regen Needed</span>
          )}
        </button>

        {openSections['Seed & Regeneration'] && (
          <div className="debug-section__body">
            <label className="debug-seed-label" htmlFor="debug-seed-input">
              Internal Planet Seed
            </label>
            <div className="debug-seed-row">
              <input
                id="debug-seed-input"
                type="text"
                className="debug-seed-input"
                value={seedInput}
                onChange={(e) => setSeedInput(e.target.value)}
                data-testid="debug-seed-input"
              />
              <button
                type="button"
                className="primary-btn debug-regen-btn"
                onClick={() => onApplySeedAndRegenerate(seedInput.trim() || seed)}
                data-testid="debug-regenerate-btn"
              >
                <RefreshCw size={13} /> Regenerate
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Collapsible Section: Performance Telemetry */}
      <div className="debug-section">
        <button
          type="button"
          className="debug-section__toggle"
          onClick={() => toggleSection('Performance Telemetry')}
        >
          {openSections['Performance Telemetry'] ? (
            <ChevronDown size={14} />
          ) : (
            <ChevronRight size={14} />
          )}
          <span>Performance Telemetry</span>
        </button>

        {openSections['Performance Telemetry'] && (
          <div className="debug-section__body telemetry-grid">
            <div className="telemetry-item">
              <span>FPS / Frame</span>
              <strong>
                {metrics.fps} fps ({metrics.frameTimeMs.toFixed(1)} ms)
              </strong>
            </div>
            <div className="telemetry-item">
              <span>Planet Gen Time</span>
              <strong>{metrics.generationTimeMs.toFixed(1)} ms</strong>
            </div>
            <div className="telemetry-item">
              <span>AI Solve Time</span>
              <strong>{metrics.aiSolveTimeMs.toFixed(2)} ms</strong>
            </div>
            <div className="telemetry-item">
              <span>Crater Mesh Update</span>
              <strong>{metrics.craterUpdateTimeMs.toFixed(2)} ms</strong>
            </div>
          </div>
        )}
      </div>

      {/* Collapsible TuningRegistry Sections */}
      {SECTIONS.slice(2).map((sectionName) => {
        const fields = TUNING_FIELDS.filter((f) => f.section === sectionName);
        const isOpen = !!openSections[sectionName];
        return (
          <div key={sectionName} className="debug-section">
            <button
              type="button"
              className="debug-section__toggle"
              onClick={() => toggleSection(sectionName)}
            >
              {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <span>{sectionName}</span>
            </button>

            {isOpen && (
              <div className="debug-section__body">
                {fields.map((field) => {
                  const val = tuning[field.key];
                  const isModified = val !== DEFAULT_TUNING[field.key];
                  return (
                    <div key={field.key} className="tuning-row">
                      <div className="tuning-row__top">
                        <label
                          htmlFor={`tuning-${field.key}`}
                          className="tuning-row__label"
                        >
                          {field.label}
                          {isModified ? ' *' : ''}
                        </label>
                        <div className="tuning-row__badges">
                          <span className={`badge badge--${field.classification}`}>
                            {field.classification}
                          </span>
                          <span className="tuning-row__val">
                            {val}
                            {field.unit ? ` ${field.unit}` : ''}
                          </span>
                        </div>
                      </div>
                      <input
                        id={`tuning-${field.key}`}
                        type="range"
                        min={field.min}
                        max={field.max}
                        step={field.step}
                        value={val}
                        onChange={(e) =>
                          onUpdateTuning(field.key, parseFloat(e.target.value))
                        }
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </aside>
  );
};
