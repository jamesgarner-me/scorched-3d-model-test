import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { soundEngine } from './audio/soundEngine';
import { GameCanvas } from './components/scene/GameCanvas';
import { DebugPanel } from './components/ui/DebugPanel';
import { HudOverlay } from './components/ui/HudOverlay';
import { LoadingScreen } from './components/ui/LoadingScreen';
import { PauseModal } from './components/ui/PauseModal';
import { WinnerOverlay } from './components/ui/WinnerOverlay';
import { solveAiTurn } from './simulation/ai';
import {
  evaluateShotError,
  resolveShotImpact,
  simulateShot,
} from './simulation/physics';
import {
  generateWindForTurn,
  placeTanksOnPlanet,
  PlanetWorld,
} from './simulation/planet';
import { createRandomSeed } from './simulation/prng';
import {
  DEFAULT_TUNING,
  PLANET_PRESETS,
  TUNING_FIELDS,
  TuningConfig,
} from './simulation/tuning';
import {
  AiDifficulty,
  AiShotMemory,
  GamePhase,
  ImpactOutcome,
  PerformanceMetrics,
  PlanetPresetId,
  ShotInput,
  TankState,
  TrajectoryPoint,
  TurnOwner,
  WindVector,
} from './simulation/types';

export interface AppProps {
  /** Optional initial seed for deterministic unit tests */
  initialSeed?: string;
  /** Optional flag to skip loading/flyover timers in unit tests */
  instantStartForTest?: boolean;
  /** Optional flag to disable WebGL canvas in headless jsdom unit tests */
  disableCanvasForTest?: boolean;
  /** Optional flag to override URL ?mode=demo detection in unit tests */
  initialDemoMode?: boolean;
}

function buildWorldBundle(
  seed: string,
  presetId: PlanetPresetId,
  tuning: TuningConfig,
  demoMode: boolean,
): {
  planet: PlanetWorld;
  tanks: Record<TurnOwner, TankState>;
  wind: WindVector;
  genTimeMs: number;
} {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const preset = PLANET_PRESETS[presetId];
  const mergedTuning: TuningConfig = {
    ...tuning,
    terrainAmplitude: tuning.terrainAmplitude,
    terrainRoughness: tuning.terrainRoughness,
    waterLevelOffset: preset.hasWater ? tuning.waterLevelOffset : -999,
  };
  const planet = new PlanetWorld(seed, presetId, mergedTuning);
  const tanks = placeTanksOnPlanet(planet, mergedTuning, demoMode);
  const wind = generateWindForTurn(seed, 1, presetId, mergedTuning);
  const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  return {
    planet,
    tanks,
    wind,
    genTimeMs: Math.max(0.2, Math.round((t1 - t0) * 100) / 100),
  };
}

export const App: React.FC<AppProps> = ({
  initialSeed,
  instantStartForTest = false,
  disableCanvasForTest = false,
  initialDemoMode,
}) => {
  const isDemoMode = useMemo(() => {
    if (initialDemoMode !== undefined) {
      return initialDemoMode;
    }
    if (typeof window === 'undefined') {
      return false;
    }
    return new URLSearchParams(window.location.search).get('mode') === 'demo';
  }, [initialDemoMode]);

  const [seed, setSeed] = useState<string>(() => initialSeed || createRandomSeed());
  const [presetId, setPresetId] = useState<PlanetPresetId>('earth');
  const [difficulty, setDifficulty] = useState<AiDifficulty>('medium');
  const [tuning, setTuning] = useState<TuningConfig>(() => ({
    ...DEFAULT_TUNING,
  }));
  const [needsRegenerate, setNeedsRegenerate] = useState(false);

  const initialBundle = useMemo(
    () => buildWorldBundle(seed, presetId, DEFAULT_TUNING, isDemoMode),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [planet, setPlanet] = useState<PlanetWorld>(initialBundle.planet);
  const [cratersVersion, setCratersVersion] = useState(0);
  const [tanks, setTanks] = useState<Record<TurnOwner, TankState>>(initialBundle.tanks);
  const [wind, setWind] = useState<WindVector>(initialBundle.wind);

  const [phase, setPhase] = useState<GamePhase>(
    instantStartForTest ? 'aiming' : 'loading',
  );
  const [loadingProgress, setLoadingProgress] = useState(
    instantStartForTest ? 100 : 12,
  );
  const [loadingStage, setLoadingStage] = useState(
    'Synthesising spherical heightfield...',
  );

  const [currentTurn, setCurrentTurn] = useState<TurnOwner>('player');
  const [turnNumber, setTurnNumber] = useState(1);
  const [winner, setWinner] = useState<TurnOwner | null>(null);

  const [chargingPower, setChargingPower] = useState<number | null>(null);
  const chargingPowerRef = useRef<number | null>(null);

  const [activeTrajectory, setActiveTrajectory] = useState<TrajectoryPoint[]>([]);
  const [flightProgressIndex, setFlightProgressIndex] = useState(0);
  const [lastImpact, setLastImpact] = useState<ImpactOutcome | null>(null);
  const [damageBanner, setDamageBanner] = useState<string | null>(null);

  const [aiHistory, setAiHistory] = useState<Record<TurnOwner, AiShotMemory[]>>({
    player: [],
    ai: [],
  });
  const [cameraFocusRequest, setCameraFocusRequest] = useState(0);

  const [isPaused, setIsPaused] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.65);

  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    fps: 60,
    frameTimeMs: 16.6,
    generationTimeMs: initialBundle.genTimeMs,
    aiSolveTimeMs: 0,
    craterUpdateTimeMs: 0,
  });

  // Held arrow keys for continuous smooth turret aiming (User Story 14)
  const heldKeysRef = useRef<Set<string>>(new Set());

  // Loading pipeline effect
  useEffect(() => {
    if (phase !== 'loading') return;

    const t1 = window.setTimeout(() => {
      setLoadingProgress(48);
      setLoadingStage('Carving tectonic ridges & ocean basins...');
    }, 140);

    const t2 = window.setTimeout(() => {
      setLoadingProgress(86);
      setLoadingStage('Deploying artillery units & calibrating gravity...');
    }, 300);

    const t3 = window.setTimeout(() => {
      setLoadingProgress(100);
      setPhase('flyover');
    }, 460);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [phase]);

  // Brief cinematic flyover before settling on player's tank (User Stories 8 & 9)
  useEffect(() => {
    if (phase !== 'flyover') return;
    const timer = window.setTimeout(() => {
      setPhase('aiming');
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [phase]);

  // Start a new match or regenerate planet with specified seed & preset
  const startMatchWithConfig = useCallback(
    (nextSeed: string, nextPresetId: PlanetPresetId, nextTuning: TuningConfig) => {
      soundEngine.stopFlightWhistle();
      const presetDefaults = PLANET_PRESETS[nextPresetId];
      const adjustedTuning: TuningConfig = {
        ...nextTuning,
        terrainAmplitude: presetDefaults.terrainAmplitude,
        terrainRoughness: presetDefaults.terrainRoughness,
        waterLevelOffset: presetDefaults.waterLevelOffset,
      };

      const bundle = buildWorldBundle(
        nextSeed,
        nextPresetId,
        adjustedTuning,
        isDemoMode,
      );
      setSeed(nextSeed);
      setPresetId(nextPresetId);
      setTuning(adjustedTuning);
      setNeedsRegenerate(false);
      setPlanet(bundle.planet);
      setCratersVersion((v) => v + 1);
      setTanks(bundle.tanks);
      setWind(bundle.wind);
      setCurrentTurn('player');
      setTurnNumber(1);
      setWinner(null);
      setChargingPower(null);
      chargingPowerRef.current = null;
      setActiveTrajectory([]);
      setFlightProgressIndex(0);
      setLastImpact(null);
      setDamageBanner(null);
      setAiHistory({ player: [], ai: [] });
      setIsPaused(false);
      setMetrics((m) => ({ ...m, generationTimeMs: bundle.genTimeMs }));

      if (instantStartForTest) {
        setPhase('aiming');
      } else {
        setLoadingProgress(15);
        setLoadingStage('Synthesising spherical heightfield...');
        setPhase('loading');
      }
    },
    [instantStartForTest, isDemoMode],
  );

  // Compute live 25% trajectory preview points (User Stories 17, 18, 19, 53)
  const previewSimulation = useMemo(() => {
    const activeTank = isDemoMode ? tanks[currentTurn] : tanks.player;
    const activePower =
      chargingPower !== null
        ? chargingPower
        : activeTank.lastPower + cratersVersion * 0;
    return simulateShot(planet, activeTank, tanks, wind, tuning, {
      shooterId: activeTank.id,
      bearingDeg: activeTank.bearingDeg,
      elevationDeg: activeTank.elevationDeg,
      power: activePower,
      varianceSeed: null, // Preview uses deterministic mean path
    });
  }, [
    planet,
    tanks,
    wind,
    tuning,
    chargingPower,
    cratersVersion,
    isDemoMode,
    currentTurn,
  ]);

  // Adjust player turret aim
  const adjustPlayerAim = useCallback(
    (deltaBearing: number, deltaElevation: number) => {
      if (
        isDemoMode ||
        currentTurn !== 'player' ||
        (phase !== 'aiming' && phase !== 'charging')
      ) {
        return;
      }
      setTanks((prev) => {
        const p = prev.player;
        const nextBearing = (((p.bearingDeg + deltaBearing) % 360) + 360) % 360;
        const nextElev = Math.max(5, Math.min(85, p.elevationDeg + deltaElevation));
        return {
          ...prev,
          player: {
            ...p,
            bearingDeg: Math.round(nextBearing * 10) / 10,
            elevationDeg: Math.round(nextElev * 10) / 10,
          },
        };
      });
    },
    [isDemoMode, currentTurn, phase],
  );

  // Fire a shot (used by both Player and AI)
  const executeShot = useCallback(
    (input: ShotInput) => {
      const shooter = tanks[input.shooterId];
      const sim = simulateShot(planet, shooter, tanks, wind, tuning, input);

      // Record shooter's chosen aim and power
      setTanks((prev) => ({
        ...prev,
        [input.shooterId]: {
          ...prev[input.shooterId],
          bearingDeg: input.bearingDeg,
          elevationDeg: input.elevationDeg,
          lastPower: input.power,
        },
      }));

      setChargingPower(null);
      chargingPowerRef.current = null;
      setDamageBanner(null);
      setActiveTrajectory(sim.points);
      setFlightProgressIndex(0);
      setPhase('flight');

      soundEngine.playFire(input.power);
      soundEngine.startFlightWhistle();

      // If an AI-controlled tank fired, record its shot in AI memory so it learns from misses (User Stories 35–37)
      if (input.shooterId === 'ai' || isDemoMode) {
        const targetId: TurnOwner = input.shooterId === 'ai' ? 'player' : 'ai';
        const err = evaluateShotError(
          tanks[input.shooterId],
          tanks[targetId],
          sim.impactPosition,
        );
        setAiHistory((prev) => ({
          ...prev,
          [input.shooterId]: [
            ...prev[input.shooterId],
            {
              turn: turnNumber,
              bearingDeg: input.bearingDeg,
              elevationDeg: input.elevationDeg,
              power: input.power,
              impactPoint: sim.impactPosition,
              targetPoint: tanks[targetId].position,
              angularErrorDeg: err.bearingErrorDeg,
              overshotRad: err.overshotRad,
            },
          ],
        }));
      }

      // Animate projectile flight
      const totalPts = sim.points.length;
      const stepIntervalMs = instantStartForTest ? 4 : 18;
      const ptsPerTick = instantStartForTest
        ? Math.max(10, Math.ceil(totalPts / 4))
        : Math.max(2, Math.ceil(totalPts / 55));

      let currentIdx = 0;
      const flightTimer = window.setInterval(() => {
        currentIdx += ptsPerTick;
        if (currentIdx >= totalPts - 1) {
          window.clearInterval(flightTimer);
          setFlightProgressIndex(totalPts - 1);

          // Resolve impact, crater carving, and blast damage
          const clonedTanks: Record<TurnOwner, TankState> = {
            player: { ...tanks.player },
            ai: { ...tanks.ai },
          };
          // Ensure shooter's updated aim/lastPower is preserved
          clonedTanks[input.shooterId].bearingDeg = input.bearingDeg;
          clonedTanks[input.shooterId].elevationDeg = input.elevationDeg;
          clonedTanks[input.shooterId].lastPower = input.power;

          const outcome = resolveShotImpact(
            planet,
            sim,
            clonedTanks,
            tuning,
            turnNumber,
          );

          setTanks(clonedTanks);
          setLastImpact(outcome);
          if (outcome.craterCreated) {
            setCratersVersion((v) => v + 1);
          }

          // Build concise damage banner (User Story 40)
          const dmgParts: string[] = [];
          if (outcome.hitWater) {
            dmgParts.push('Splash in Water!');
          } else if (outcome.directHit) {
            dmgParts.push('Direct Hit!');
          } else {
            dmgParts.push('Crater Impact!');
          }

          if (outcome.damages.ai > 0) {
            dmgParts.push(
              `${isDemoMode ? 'Ares Automaton' : 'AI Tank'} -${outcome.damages.ai} HP`,
            );
          }
          if (outcome.damages.player > 0) {
            dmgParts.push(
              `${isDemoMode ? 'Vanguard-1' : 'Your Tank'} -${outcome.damages.player} HP`,
            );
          }
          if (outcome.damages.ai === 0 && outcome.damages.player === 0) {
            dmgParts.push('No Blast Damage');
          }
          setDamageBanner(dmgParts.join(' • '));

          if (outcome.killedTank) {
            // Match-ending hit: trigger enhanced destruction sequence (User Story 43)
            soundEngine.playDestructionSequence();
            setPhase('destruction');
            const winOwner: TurnOwner = outcome.killedTank === 'ai' ? 'player' : 'ai';
            window.setTimeout(
              () => {
                setWinner(winOwner);
                setPhase('gameover');
              },
              instantStartForTest ? 40 : 2100,
            );
          } else {
            soundEngine.playImpact(outcome.hitWater, outcome.directHit);
            setPhase('impact');
            window.setTimeout(
              () => {
                const nextOwner: TurnOwner =
                  input.shooterId === 'player' ? 'ai' : 'player';
                const nextTurnNum =
                  nextOwner === 'player' ? turnNumber + 1 : turnNumber;
                setCurrentTurn(nextOwner);
                setTurnNumber(nextTurnNum);
                setWind(
                  generateWindForTurn(
                    seed,
                    nextTurnNum * 2 + (nextOwner === 'ai' ? 1 : 0),
                    presetId,
                    tuning,
                  ),
                );
                setPhase('aiming');
              },
              instantStartForTest ? 30 : 1200,
            );
          }
        } else {
          setFlightProgressIndex(currentIdx);
        }
      }, stepIntervalMs);
    },
    [
      tanks,
      planet,
      wind,
      tuning,
      turnNumber,
      instantStartForTest,
      seed,
      presetId,
      isDemoMode,
    ],
  );

  // Start & release Spacebar power charging (User Stories 15 & 16)
  const startCharging = useCallback(() => {
    if (isDemoMode || currentTurn !== 'player' || phase !== 'aiming' || isPaused) {
      return;
    }
    setChargingPower(10);
    chargingPowerRef.current = 10;
    setPhase('charging');
  }, [isDemoMode, currentTurn, phase, isPaused]);

  const releaseChargeAndFire = useCallback(() => {
    if (isDemoMode || currentTurn !== 'player' || phase !== 'charging') {
      return;
    }
    const finalPower =
      chargingPowerRef.current !== null
        ? chargingPowerRef.current
        : tanks.player.lastPower;
    executeShot({
      shooterId: 'player',
      bearingDeg: tanks.player.bearingDeg,
      elevationDeg: tanks.player.elevationDeg,
      power: Math.round(finalPower),
      varianceSeed: `${seed}::shot-variance::player::${turnNumber}`,
    });
  }, [isDemoMode, currentTurn, phase, tanks.player, executeShot, seed, turnNumber]);

  // Animate power bar while charging
  useEffect(() => {
    if (phase !== 'charging') return;
    let direction = 1;
    const interval = window.setInterval(() => {
      setChargingPower((prev) => {
        const current = prev ?? 10;
        let next = current + direction * 2.2;
        if (next >= 100) {
          next = 100;
          direction = -1;
        } else if (next <= 10) {
          next = 10;
          direction = 1;
        }
        chargingPowerRef.current = next;
        return next;
      });
    }, 25);

    return () => window.clearInterval(interval);
  }, [phase]);

  // Continuous smooth aiming while holding arrow keys (User Stories 12, 13, 14)
  useEffect(() => {
    const interval = window.setInterval(() => {
      if (
        isPaused ||
        currentTurn !== 'player' ||
        (phase !== 'aiming' && phase !== 'charging')
      ) {
        return;
      }
      const keys = heldKeysRef.current;
      let dB = 0;
      let dE = 0;
      if (keys.has('ArrowLeft')) dB -= 1.2;
      if (keys.has('ArrowRight')) dB += 1.2;
      if (keys.has('ArrowUp')) dE += 0.9;
      if (keys.has('ArrowDown')) dE -= 0.9;
      if (dB !== 0 || dE !== 0) {
        adjustPlayerAim(dB, dE);
      }
    }, 24);

    return () => window.clearInterval(interval);
  }, [isPaused, currentTurn, phase, adjustPlayerAim]);

  // Global keyboard listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'SELECT' ||
          target.tagName === 'TEXTAREA')
      ) {
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        setIsPaused((prev) => !prev);
        return;
      }

      if (e.key === '`') {
        e.preventDefault();
        setDebugOpen((prev) => !prev);
        return;
      }

      if (e.key === 'c' || e.key === 'C') {
        setCameraFocusRequest((c) => c + 1);
        return;
      }

      if (phase === 'flyover' && e.code === 'Space') {
        e.preventDefault();
        setPhase('aiming');
        return;
      }

      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        e.preventDefault();
        if (!e.repeat) {
          // Immediate step on tap + continuous hold
          const stepB = e.key === 'ArrowLeft' ? -1.5 : e.key === 'ArrowRight' ? 1.5 : 0;
          const stepE = e.key === 'ArrowUp' ? 1.2 : e.key === 'ArrowDown' ? -1.2 : 0;
          adjustPlayerAim(stepB, stepE);
        }
        heldKeysRef.current.add(e.key);
      }

      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        startCharging();
      }
    };

    const handleKeyUp = (e: KeyboardEvent): void => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        heldKeysRef.current.delete(e.key);
      }
      if (e.code === 'Space') {
        e.preventDefault();
        releaseChargeAndFire();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [phase, adjustPlayerAim, startCharging, releaseChargeAndFire]);

  // AI turn trigger (User Stories 32, 34–38; also drives Vanguard-1 in ?mode=demo)
  useEffect(() => {
    const isAiControlledTurn = currentTurn === 'ai' || isDemoMode;
    if (!isAiControlledTurn || phase !== 'aiming' || isPaused) {
      return;
    }

    const thinkDelayMs = instantStartForTest ? 25 : 950;
    const timer = window.setTimeout(() => {
      const solved = solveAiTurn(
        planet,
        tanks,
        wind,
        tuning,
        difficulty,
        aiHistory[currentTurn],
        seed,
        turnNumber,
        currentTurn,
      );
      setMetrics((m) => ({ ...m, aiSolveTimeMs: solved.solveTimeMs }));
      executeShot(solved.shotInput);
    }, thinkDelayMs);

    return () => window.clearTimeout(timer);
  }, [
    currentTurn,
    isDemoMode,
    phase,
    isPaused,
    instantStartForTest,
    planet,
    tanks,
    wind,
    tuning,
    difficulty,
    aiHistory,
    seed,
    turnNumber,
    executeShot,
  ]);

  // Handle TuningRegistry updates
  const handleUpdateTuning = useCallback(
    <K extends keyof TuningConfig>(key: K, value: TuningConfig[K]) => {
      setTuning((prev) => ({ ...prev, [key]: value }));
      const fieldMeta = TUNING_FIELDS.find((f) => f.key === key);
      if (fieldMeta?.classification === 'regenerate') {
        setNeedsRegenerate(true);
      }
    },
    [],
  );

  const handleResetTuning = useCallback(() => {
    const presetDefaults = PLANET_PRESETS[presetId];
    setTuning({
      ...DEFAULT_TUNING,
      terrainAmplitude: presetDefaults.terrainAmplitude,
      terrainRoughness: presetDefaults.terrainRoughness,
      waterLevelOffset: presetDefaults.waterLevelOffset,
    });
    setNeedsRegenerate(false);
  }, [presetId]);

  const handleCraterMeshUpdated = useCallback((craterUpdateTimeMs: number) => {
    setMetrics((m) => ({ ...m, craterUpdateTimeMs }));
  }, []);

  const handleFrameSample = useCallback((fps: number, frameTimeMs: number) => {
    setMetrics((m) => ({ ...m, fps, frameTimeMs }));
  }, []);

  return (
    <main className="app-shell">
      {!disableCanvasForTest && (
        <GameCanvas
          planet={planet}
          cratersVersion={cratersVersion}
          tanks={tanks}
          currentTurn={currentTurn}
          phase={phase}
          previewPoints={previewSimulation.previewPoints}
          guideOpacity={tuning.guideOpacity}
          activeTrajectory={activeTrajectory}
          flightProgressIndex={flightProgressIndex}
          lastImpact={lastImpact}
          cameraFocusRequest={cameraFocusRequest}
          onCraterMeshUpdated={handleCraterMeshUpdated}
          onFrameSample={handleFrameSample}
        />
      )}

      {phase === 'loading' && (
        <LoadingScreen
          progress={loadingProgress}
          stageLabel={loadingStage}
          presetId={presetId}
          seed={seed}
        />
      )}

      <HudOverlay
        tanks={tanks}
        currentTurn={currentTurn}
        turnNumber={turnNumber}
        phase={phase}
        presetId={presetId}
        difficulty={difficulty}
        wind={wind}
        planetRadius={planet.baseRadius}
        cratersCount={planet.craters.length}
        chargingPower={chargingPower}
        damageBanner={damageBanner}
        debugOpen={debugOpen}
        demoMode={isDemoMode}
        onSelectPreset={(nextPreset) =>
          startMatchWithConfig(createRandomSeed(), nextPreset, tuning)
        }
        onSelectDifficulty={(nextDiff) => setDifficulty(nextDiff)}
        onAdjustAim={adjustPlayerAim}
        onStartCharge={startCharging}
        onReleaseCharge={releaseChargeAndFire}
        onSkipFlyover={() => setPhase('aiming')}
        onFocusPlayerCamera={() => setCameraFocusRequest((c) => c + 1)}
        onOpenPause={() => setIsPaused(true)}
        onToggleDebug={() => setDebugOpen((d) => !d)}
      />

      {debugOpen && (
        <DebugPanel
          seed={seed}
          tuning={tuning}
          metrics={metrics}
          needsRegenerate={needsRegenerate}
          onUpdateTuning={handleUpdateTuning}
          onResetTuning={handleResetTuning}
          onApplySeedAndRegenerate={(customSeed) =>
            startMatchWithConfig(customSeed, presetId, tuning)
          }
        />
      )}

      {isPaused && phase !== 'gameover' && (
        <PauseModal
          muted={muted}
          volume={volume}
          presetId={presetId}
          difficulty={difficulty}
          onToggleMute={() => {
            const next = !muted;
            setMuted(next);
            soundEngine.setMuted(next);
          }}
          onChangeVolume={(v) => {
            setVolume(v);
            soundEngine.setVolume(v);
          }}
          onSelectPreset={(nextPreset) =>
            startMatchWithConfig(createRandomSeed(), nextPreset, tuning)
          }
          onSelectDifficulty={(nextDiff) => setDifficulty(nextDiff)}
          onResume={() => setIsPaused(false)}
          onNewMatch={() => startMatchWithConfig(createRandomSeed(), presetId, tuning)}
        />
      )}

      {phase === 'gameover' && winner && (
        <WinnerOverlay
          winner={winner}
          tanks={tanks}
          turnNumber={turnNumber}
          cratersCount={planet.craters.length}
          presetId={presetId}
          difficulty={difficulty}
          demoMode={isDemoMode}
          onNewMatch={() => startMatchWithConfig(createRandomSeed(), presetId, tuning)}
        />
      )}
    </main>
  );
};

export default App;
