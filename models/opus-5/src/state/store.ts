import { create } from 'zustand';
import { decideShot, type Aim, type Difficulty } from '../game/ai';
import { createMatch, type DamageEvent, type Match } from '../game/match';
import { perf } from '../game/perf';
import type { ImpactKind, ShotPath, TankId } from '../game/physics';
import type { PresetId } from '../game/presets';
import { randomSeed } from '../game/rng';
import { tuning } from '../game/tuning';
import { clamp, type Vec3 } from '../game/vec';
import { audio } from '../audio/audio';

export type Phase =
  | 'menu'
  | 'loading'
  | 'flyover'
  | 'aim'
  | 'charging'
  | 'flight'
  | 'impact'
  | 'aiThink'
  | 'gameover';

export interface ActiveShot {
  shooter: TankId;
  path: ShotPath;
}

export interface Blast {
  id: number;
  position: Vec3;
  dir: Vec3;
  kind: ImpactKind;
  /** A match-ending hit gets the full destruction sequence. */
  fatal: boolean;
}

interface GameState {
  phase: Phase;
  match: Match | null;
  progress: { fraction: number; label: string };
  preset: PresetId;
  difficulty: Difficulty;
  seedInput: string;

  bearing: number;
  elevation: number;
  power: number;
  charging: boolean;

  playerHealth: number;
  aiHealth: number;
  wind: { bearing: number; strength: number; magnitude: number };
  round: number;

  activeShot: ActiveShot | null;
  blast: Blast | null;
  /** Bumped whenever craters change, so the terrain meshes re-upload. */
  terrainVersion: number;
  /** Bumped when a fresh planet is ready, so the scene rebuilds from scratch. */
  matchVersion: number;

  lastDamage: DamageEvent | null;
  statusMessage: string;
  winner: TankId | null;

  paused: boolean;
  muted: boolean;
  debugOpen: boolean;
  showControls: boolean;

  startMatch(options?: { preset?: PresetId; difficulty?: Difficulty; seed?: string }): Promise<void>;
  regeneratePlanet(): Promise<void>;
  skipFlyover(): void;
  adjustAim(dBearing: number, dElevation: number): void;
  beginCharge(): void;
  setPower(power: number): void;
  releaseCharge(): void;
  onShotLanded(): void;
  setPaused(paused: boolean): void;
  toggleMute(): void;
  toggleDebug(): void;
  setPreset(preset: PresetId): void;
  setDifficulty(difficulty: Difficulty): void;
  setSeedInput(seed: string): void;
  returnToMenu(): void;
  setShowControls(show: boolean): void;
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export const useGame = create<GameState>((set, get) => ({
  phase: 'menu',
  match: null,
  progress: { fraction: 0, label: '' },
  preset: 'earth',
  difficulty: 'medium',
  seedInput: '',

  bearing: 0,
  elevation: 35,
  power: 50,
  charging: false,

  playerHealth: tuning.maxHealth,
  aiHealth: tuning.maxHealth,
  wind: { bearing: 0, strength: 0, magnitude: 0 },
  round: 1,

  activeShot: null,
  blast: null,
  terrainVersion: 0,
  matchVersion: 0,

  lastDamage: null,
  statusMessage: '',
  winner: null,

  paused: false,
  muted: false,
  debugOpen: false,
  showControls: true,

  async startMatch(options = {}) {
    const state = get();
    const preset = options.preset ?? state.preset;
    const difficulty = options.difficulty ?? state.difficulty;
    const seed = options.seed ?? state.seedInput ?? '';
    set({
      phase: 'loading',
      preset,
      difficulty,
      progress: { fraction: 0, label: 'Seeding world' },
      activeShot: null,
      blast: null,
      lastDamage: null,
      winner: null,
      paused: false,
      statusMessage: '',
    });

    // Generation is usually fast; hold the loading screen long enough to be read.
    const startedAt = Date.now();
    const match = await createMatch({
      seed: seed || randomSeed(),
      preset,
      difficulty,
      onProgress: (p) => set({ progress: p }),
    });
    await wait(Math.max(0, 900 - (Date.now() - startedAt)));
    perf.generationMillis = match.planet.generationMillis;

    set((s) => ({
      match,
      seedInput: match.seed,
      phase: 'flyover',
      bearing: match.tanks.player.bearing,
      elevation: match.tanks.player.elevation,
      power: match.tanks.player.lastPower,
      playerHealth: match.tanks.player.health,
      aiHealth: match.tanks.ai.health,
      wind: match.windReadout(),
      round: 1,
      terrainVersion: s.terrainVersion + 1,
      matchVersion: s.matchVersion + 1,
      statusMessage: `${match.planet.preset.name} · radius ${match.planet.radius} · seed ${match.seed}`,
    }));

    await wait(5200);
    if (get().phase === 'flyover') get().skipFlyover();
  },

  async regeneratePlanet() {
    const { seedInput, preset, difficulty } = get();
    await get().startMatch({ preset, difficulty, seed: seedInput });
  },

  skipFlyover() {
    if (get().phase !== 'flyover') return;
    set({ phase: 'aim', statusMessage: 'Your turn — aim and fire' });
  },

  adjustAim(dBearing, dElevation) {
    const { match, phase } = get();
    if (!match || (phase !== 'aim' && phase !== 'charging')) return;
    const bearing = (get().bearing + dBearing + 360) % 360;
    const elevation = clamp(get().elevation + dElevation, 2, 88);
    match.tanks.player.bearing = bearing;
    match.tanks.player.elevation = elevation;
    set({ bearing, elevation });
  },

  beginCharge() {
    if (get().phase !== 'aim') return;
    audio.charge(true);
    set({ phase: 'charging', charging: true, power: 0 });
  },

  setPower(power) {
    if (!get().charging) return;
    set({ power: clamp(power, 0, 100) });
  },

  releaseCharge() {
    const { match, charging } = get();
    if (!match || !charging) return;
    audio.charge(false);
    const aim: Aim = { bearing: get().bearing, elevation: get().elevation, power: get().power };
    set({ charging: false });
    fireShot(set, get, 'player', aim);
  },

  onShotLanded() {
    const { match, activeShot } = get();
    if (!match || !activeShot) return;
    const impact = activeShot.path.impact;
    set({ activeShot: null, phase: 'impact' });

    if (!impact) {
      set({ statusMessage: 'The shell left orbit. Nothing hit.' });
      void advanceTurn(set, get);
      return;
    }

    const { damage, craterMillis } = match.resolveImpact(activeShot.shooter, impact);
    perf.craterMillis = craterMillis;
    const fatal = damage.destroyed !== null;
    audio.impact(impact.kind, fatal);

    if (activeShot.shooter === 'ai') match.noteAiResult(damage.distanceToTarget);

    set((s) => ({
      terrainVersion: s.terrainVersion + 1,
      playerHealth: match.tanks.player.health,
      aiHealth: match.tanks.ai.health,
      lastDamage: damage,
      blast: { id: s.terrainVersion + 1, position: impact.position, dir: impact.dir, kind: impact.kind, fatal },
      statusMessage: describeImpact(damage, activeShot.shooter),
    }));

    void advanceTurn(set, get);
  },

  setPaused(paused) {
    set({ paused });
  },
  toggleMute() {
    const muted = !get().muted;
    audio.setMuted(muted);
    set({ muted });
  },
  toggleDebug() {
    set({ debugOpen: !get().debugOpen });
  },
  setPreset(preset) {
    set({ preset });
  },
  setDifficulty(difficulty) {
    set({ difficulty });
  },
  setSeedInput(seed) {
    set({ seedInput: seed });
  },
  returnToMenu() {
    // Clear the seed so the menu's default is a fresh world, not a replay of the
    // match just finished. Typing a seed deliberately still reproduces one.
    set({ phase: 'menu', match: null, paused: false, activeShot: null, blast: null, seedInput: '' });
  },
  setShowControls(show) {
    set({ showControls: show });
  },
}));

type Setter = (partial: Partial<GameState> | ((s: GameState) => Partial<GameState>)) => void;
type Getter = () => GameState;

function fireShot(set: Setter, get: Getter, shooter: TankId, aim: Aim): void {
  const match = get().match;
  if (!match) return;
  const path = match.launch(shooter, aim);
  audio.fire();
  set({
    phase: 'flight',
    activeShot: { shooter, path },
    power: aim.power,
    bearing: aim.bearing,
    elevation: aim.elevation,
    statusMessage: shooter === 'player' ? 'Shell away…' : 'Incoming!',
  });
}

async function advanceTurn(set: Setter, get: Getter): Promise<void> {
  const match = get().match;
  if (!match) return;

  if (match.winner) {
    await wait(match.winner ? 2600 : 1200);
    audio.victory(match.winner === 'player');
    set({ phase: 'gameover', winner: match.winner });
    return;
  }

  await wait(1400);
  if (!get().match) return;
  const next = match.endTurn();
  set({ round: match.round });

  if (next === 'player') {
    set({
      phase: 'aim',
      bearing: match.tanks.player.bearing,
      elevation: match.tanks.player.elevation,
      power: match.tanks.player.lastPower,
      statusMessage: 'Your turn — aim and fire',
    });
    return;
  }

  set({ phase: 'aiThink', statusMessage: 'Enemy is ranging…' });
  await wait(tuning.aiThinkTime * 1000);
  if (!get().match || get().phase !== 'aiThink') return;

  const decision = decideShot(
    match.world(),
    match.tanks.ai.position,
    match.bodyCentre('player'),
    match.aiMemory,
  );
  perf.aiSolveMillis = decision.solveMillis;
  fireShot(set, get, 'ai', decision.aim);
}

function describeImpact(damage: DamageEvent, shooter: TankId): string {
  const target: TankId = shooter === 'player' ? 'ai' : 'player';
  const dealtToTarget = damage.dealt[target];
  const self = damage.dealt[shooter];
  const who = shooter === 'player' ? 'You' : 'Enemy';

  if (damage.destroyed) {
    return `${damage.destroyed === 'player' ? 'Your tank' : 'Enemy tank'} destroyed`;
  }
  if (dealtToTarget > 0) {
    const label = damage.distanceToTarget < tuning.tankHitRadius * 1.4 ? 'Direct hit' : 'Hit';
    return `${label} — ${dealtToTarget} damage (${damage.distanceToTarget.toFixed(1)}m from target)`;
  }
  if (self > 0) {
    return `${who} caught the blast — ${self} self-damage`;
  }
  if (damage.kind === 'water') return `Splash — ${damage.distanceToTarget.toFixed(0)}m short of the target`;
  return `Miss — ${damage.distanceToTarget.toFixed(0)}m from the target`;
}
