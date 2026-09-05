import { useEffect, useState } from 'react';
import { perf } from '../game/perf';
import { resetTuning, setTuning, tuning, TUNING_META, type TuningScope } from '../game/tuning';
import { randomSeed } from '../game/rng';
import { useGame } from '../state/store';

const SCOPE_HINT: Record<TuningScope, string> = {
  live: 'Applies immediately',
  'next-shot': 'Applies to the next shot',
  regenerate: 'Needs a planet regeneration',
  'new-match': 'Applies from the next match',
};

/**
 * Development-only tuning surface. Every value is labelled with when the change takes
 * effect, and the seed field reproduces any planet exactly.
 */
export function DebugPanel() {
  const [, force] = useState(0);
  const match = useGame((s) => s.match);
  const seedInput = useGame((s) => s.seedInput);
  const setSeedInput = useGame((s) => s.setSeedInput);
  const regeneratePlanet = useGame((s) => s.regeneratePlanet);
  const startMatch = useGame((s) => s.startMatch);
  const toggleDebug = useGame((s) => s.toggleDebug);
  const [metrics, setMetrics] = useState({ ...perf });

  useEffect(() => {
    const id = setInterval(() => setMetrics({ ...perf }), 250);
    return () => clearInterval(id);
  }, []);

  const sections = TUNING_META.reduce<Record<string, typeof TUNING_META>>((acc, entry) => {
    (acc[entry.section] ??= []).push(entry);
    return acc;
  }, {});

  return (
    <div className="panel debug">
      <h2>
        <span>Debug · tuning</span>
        <button className="btn ghost" style={{ padding: '2px 8px', fontSize: 10 }} onClick={toggleDebug}>
          close ` 
        </button>
      </h2>

      <details className="debug-section" open>
        <summary>World</summary>
        <div className="field-row">
          <input
            type="text"
            value={seedInput}
            onChange={(e) => setSeedInput(e.target.value.toUpperCase())}
            placeholder="seed"
          />
          <button className="btn ghost" style={{ padding: '6px 10px', fontSize: 10 }} onClick={() => setSeedInput(randomSeed())}>
            roll
          </button>
        </div>
        <div className="metrics">
          <span>preset</span>
          <span>{match?.planet.preset.name ?? '—'}</span>
          <span>radius</span>
          <span>{match?.planet.radius ?? '—'}</span>
          <span>sea level</span>
          <span>{match ? match.planet.seaLevel.toFixed(1) : '—'}</span>
          <span>separation</span>
          <span>{match ? `${match.separationDegrees().toFixed(1)}°` : '—'}</span>
          <span>craters</span>
          <span>{match?.planet.craterCount ?? 0}</span>
          <span>wind</span>
          <span>{match ? match.windReadout().magnitude.toFixed(2) : '—'}</span>
        </div>
        <div className="actions" style={{ marginTop: 8 }}>
          <button className="btn ghost" style={{ padding: '6px 10px', fontSize: 10 }} onClick={() => void regeneratePlanet()}>
            regenerate
          </button>
          <button className="btn ghost" style={{ padding: '6px 10px', fontSize: 10 }} onClick={() => void startMatch({ seed: '' })}>
            new match
          </button>
        </div>
      </details>

      <details className="debug-section" open>
        <summary>Performance</summary>
        <div className="metrics">
          <span>fps</span>
          <span>{metrics.fps.toFixed(0)}</span>
          <span>frame</span>
          <span>{metrics.frameMillis.toFixed(1)} ms</span>
          <span>generation</span>
          <span>{metrics.generationMillis.toFixed(0)} ms</span>
          <span>ai solve</span>
          <span>{metrics.aiSolveMillis.toFixed(1)} ms</span>
          <span>crater carve</span>
          <span>{metrics.craterMillis.toFixed(2)} ms</span>
          <span>terrain upload</span>
          <span>{metrics.terrainUploadMillis.toFixed(1)} ms</span>
          <span>guide solve</span>
          <span>{metrics.guideMillis.toFixed(2)} ms</span>
          <span>triangles</span>
          <span>{metrics.triangles.toLocaleString()}</span>
        </div>
      </details>

      {Object.entries(sections).map(([section, entries]) => (
        <details className="debug-section" key={section}>
          <summary>{section}</summary>
          {entries.map((entry) => (
            <div className="tune" key={entry.key}>
              <span className="tune-label">
                {entry.label}
                <span className={`scope ${entry.scope}`} title={SCOPE_HINT[entry.scope]}>
                  {entry.scope}
                </span>
              </span>
              <span className="tune-value">{formatValue(tuning[entry.key])}</span>
              <input
                type="range"
                min={entry.min}
                max={entry.max}
                step={entry.step}
                value={tuning[entry.key]}
                onChange={(e) => {
                  setTuning(entry.key, Number(e.target.value));
                  force((n) => n + 1);
                }}
              />
            </div>
          ))}
        </details>
      ))}

      <div className="actions" style={{ marginTop: 10 }}>
        <button
          className="btn ghost"
          style={{ padding: '6px 10px', fontSize: 10 }}
          onClick={() => {
            resetTuning();
            force((n) => n + 1);
          }}
        >
          reset defaults
        </button>
      </div>
    </div>
  );
}

function formatValue(value: number): string {
  if (Math.abs(value) >= 100) return value.toFixed(0);
  if (Math.abs(value) >= 1) return value.toFixed(2);
  return value.toFixed(4);
}
