import { createAiMemory, isReachable, learnFromShot, type AiMemory, type Aim, type Difficulty } from './ai';
import { blastProfile, damageToTank } from './damage';
import { generatePlanet, Planet, type GenerationProgress } from './planet';
import {
  aimVelocity,
  applyVariance,
  simulateShot,
  type Impact,
  type ImpactKind,
  type ShotPath,
  type SimTank,
  type SimWorld,
  type TankId,
} from './physics';
import type { PresetId } from './presets';
import { makeRng, randomSeed, type Rng } from './rng';
import { muzzlePoint, TANK } from './tank';
import { tuning } from './tuning';
import {
  aimDirection,
  angleBetween,
  bearingOf,
  clamp,
  dot,
  mulAdd,
  norm,
  rotateAbout,
  scale,
  sub,
  surfaceFrame,
  type Frame,
  type Vec3,
} from './vec';

export interface TankState {
  id: TankId;
  /** Unit direction from the planet centre — the tank's home on the sphere. */
  dir: Vec3;
  /** Ground contact point. */
  position: Vec3;
  frame: Frame;
  health: number;
  maxHealth: number;
  bearing: number;
  elevation: number;
  /** Power used on the last shot; the guide defaults to it so you can range in. */
  lastPower: number;
}

export interface DamageEvent {
  shooter: TankId;
  kind: ImpactKind;
  /** Damage dealt, keyed by the tank that took it. */
  dealt: { player: number; ai: number };
  distanceToTarget: number;
  destroyed: TankId | null;
}

export interface FireOutcome {
  path: ShotPath;
  damage: DamageEvent | null;
  craterMillis: number;
}

export interface MatchOptions {
  seed?: string;
  preset: PresetId;
  difficulty: Difficulty;
}

/**
 * The rules of a match: two tanks, one planet, alternating shots.
 * Deliberately free of Three.js and React so it can be unit-tested in Node.
 */
export class Match {
  readonly seed: string;
  readonly planet: Planet;
  readonly difficulty: Difficulty;
  readonly tanks: Record<TankId, TankState>;
  readonly aiMemory: AiMemory;
  /** Constant wind acceleration for the whole match, world space. */
  wind: Vec3;
  windSpeed: number;
  turn: TankId = 'player';
  round = 1;
  winner: TankId | null = null;
  lastDamage: DamageEvent | null = null;
  readonly rng: Rng;
  private shotCounter = 0;

  constructor(seed: string, planet: Planet, tanks: Record<TankId, TankState>, wind: Vec3, difficulty: Difficulty) {
    this.seed = seed;
    this.planet = planet;
    this.tanks = tanks;
    this.wind = wind;
    this.windSpeed = Math.sqrt(wind.x * wind.x + wind.y * wind.y + wind.z * wind.z);
    this.difficulty = difficulty;
    this.rng = makeRng(`${seed}:match`);
    this.aiMemory = createAiMemory(difficulty, makeRng(`${seed}:ai`));
  }

  /** The simulation view of this match. One shared world for guide, shell and AI. */
  world(): SimWorld {
    const planet = this.planet;
    const tanks: SimTank[] = (['player', 'ai'] as TankId[])
      .filter((id) => this.tanks[id].health > 0)
      .map((id) => ({
        id,
        position: this.bodyCentre(id),
        hitRadius: tuning.tankHitRadius,
      }));
    return {
      radius: planet.radius,
      seaLevel: planet.seaLevel,
      hasOcean: planet.hasOcean,
      gravity: planet.preset.gravity,
      muzzleScale: planet.preset.muzzleScale,
      wind: this.wind,
      heightAt: (d) => planet.heightAt(d),
      tanks,
    };
  }

  /** Centre of the hull — what a blast is measured against. */
  bodyCentre(id: TankId): Vec3 {
    const tank = this.tanks[id];
    return mulAdd(tank.position, tank.frame.up, TANK.trackHeight + TANK.bodyHeight * 0.5);
  }

  /** Where the shell leaves the barrel for a given aim. */
  muzzle(id: TankId, aim?: Partial<Aim>): Vec3 {
    const tank = this.tanks[id];
    return muzzlePoint(
      tank.position,
      tank.frame,
      aim?.bearing ?? tank.bearing,
      aim?.elevation ?? tank.elevation,
    );
  }

  /** Deterministic mean trajectory — no variance. This is what the guide draws. */
  previewPath(id: TankId, aim: Aim): ShotPath {
    const tank = this.tanks[id];
    const origin = muzzlePoint(tank.position, tank.frame, aim.bearing, aim.elevation);
    const velocity = aimVelocity(
      tank.frame,
      aim.bearing,
      aim.elevation,
      aim.power,
      this.planet.preset.muzzleScale,
    );
    return simulateShot(origin, velocity, this.world());
  }

  /** Wind as the HUD shows it: a compass bearing in the player's local frame plus a 0–1 strength. */
  windReadout(): { bearing: number; strength: number; magnitude: number } {
    const frame = this.tanks.player.frame;
    const [min, max] = this.planet.preset.windRange;
    const span = this.planet.preset.gravity * (max - min);
    const strength = span > 0 ? clamp((this.windSpeed - this.planet.preset.gravity * min) / span, 0, 1) : 0;
    return {
      bearing: this.windSpeed > 1e-6 ? bearingOf(frame, this.wind) : 0,
      strength,
      magnitude: this.windSpeed,
    };
  }

  /**
   * Launch a shot: commit the aim, roll the variance, and integrate the whole flight.
   * Nothing is resolved yet — the presentation layer replays this path and then calls
   * `resolveImpact`, so damage lands exactly when the shell is seen to land.
   */
  launch(id: TankId, aim: Aim): ShotPath {
    const tank = this.tanks[id];
    tank.bearing = aim.bearing;
    tank.elevation = aim.elevation;
    tank.lastPower = aim.power;

    const shotRng = makeRng(`${this.seed}:shot:${this.shotCounter++}`);
    const baseDir = aimDirection(tank.frame, aim.bearing, aim.elevation);
    const speed = aimVelocity(
      tank.frame,
      aim.bearing,
      aim.elevation,
      aim.power,
      this.planet.preset.muzzleScale,
    );
    const baseSpeed = Math.sqrt(speed.x * speed.x + speed.y * speed.y + speed.z * speed.z);
    const varied = applyVariance(baseDir, baseSpeed, shotRng);
    const origin = muzzlePoint(tank.position, tank.frame, aim.bearing, aim.elevation);
    const path = simulateShot(origin, scale(varied.direction, varied.speed), this.world());

    return path;
  }

  /** Launch and resolve in one step. Used by the headless rules tests. */
  fire(id: TankId, aim: Aim): FireOutcome {
    const path = this.launch(id, aim);
    if (!path.impact) return { path, damage: null, craterMillis: 0 };
    const { damage, craterMillis } = this.resolveImpact(id, path.impact);
    return { path, damage, craterMillis };
  }

  /** Apply blast damage and carve the crater for an impact. Exposed for tests. */
  resolveImpact(shooter: TankId, impact: Impact): { damage: DamageEvent; craterMillis: number } {
    const { position, kind } = impact;
    const profile = blastProfile(kind);
    const dealt = { player: 0, ai: 0 };
    let destroyed: TankId | null = null;

    for (const id of ['player', 'ai'] as TankId[]) {
      const tank = this.tanks[id];
      if (tank.health <= 0) continue;
      // A shell that strikes the hull itself deals the full blast, not a falloff
      // value measured from wherever on the armour it happened to land.
      const amount =
        kind === 'tank' && impact.tankId === id
          ? profile.maxDamage
          : damageToTank(position, this.bodyCentre(id), profile);
      if (amount <= 0.5) continue;
      dealt[id] = Math.round(amount);
      tank.health = Math.max(0, tank.health - dealt[id]);
      if (tank.health === 0) destroyed = id;
    }

    let craterMillis = 0;
    // Water splashes; it never dredges the seabed.
    if (kind !== 'water') {
      const radius = tuning.blastRadius * tuning.craterRadiusScale;
      const result = this.planet.carve(
        norm(position),
        radius,
        radius * tuning.craterDepthScale,
        (['player', 'ai'] as TankId[]).map((id) => ({
          dir: this.tanks[id].dir,
          radius: tuning.tankFootprint,
        })),
      );
      craterMillis = result.millis;
    }

    const target: TankId = shooter === 'player' ? 'ai' : 'player';
    const damage: DamageEvent = {
      shooter,
      kind,
      dealt,
      distanceToTarget: Math.sqrt(
        Math.pow(position.x - this.bodyCentre(target).x, 2) +
          Math.pow(position.y - this.bodyCentre(target).y, 2) +
          Math.pow(position.z - this.bodyCentre(target).z, 2),
      ),
      destroyed,
    };
    this.lastDamage = damage;
    if (destroyed) this.winner = destroyed === 'player' ? 'ai' : 'player';
    return { damage, craterMillis };
  }

  /** Hand the turn over. Returns the tank that now acts. */
  endTurn(): TankId {
    if (this.turn === 'ai') this.round += 1;
    this.turn = this.turn === 'player' ? 'ai' : 'player';
    return this.turn;
  }

  /** Fold an AI shot's outcome back into its aim memory, so its shots walk in. */
  noteAiResult(missDistance: number): void {
    learnFromShot(this.aiMemory, missDistance, this.rng);
  }

  /** Angular separation of the two tanks, in degrees — handy for the debug panel. */
  separationDegrees(): number {
    return (angleBetween(this.tanks.player.position, this.tanks.ai.position) * 180) / Math.PI;
  }
}

export interface NewMatchOptions extends MatchOptions {
  onProgress?: (p: GenerationProgress) => void;
}

/** Generate a fresh planet, place both tanks somewhere fair, and open the match. */
export async function createMatch(options: NewMatchOptions): Promise<Match> {
  const seed = options.seed?.trim() || randomSeed();
  const planet = await generatePlanet({ seed, preset: options.preset }, options.onProgress);
  options.onProgress?.({ fraction: 0.9, label: 'Deploying tanks' });

  const rng = makeRng(`${seed}:placement`);
  const placement = placeTanks(planet, rng, options.difficulty);

  const makeTank = (id: TankId, dir: Vec3, bearing: number): TankState => {
    const position = planet.surfacePoint(dir, false);
    const frame = surfaceFrame(position);
    return {
      id,
      dir,
      position,
      frame,
      health: tuning.maxHealth,
      maxHealth: tuning.maxHealth,
      bearing,
      elevation: 35,
      lastPower: 50,
    };
  };

  const playerPos = planet.surfacePoint(placement.player, false);
  const aiPos = planet.surfacePoint(placement.ai, false);
  const playerFrame = surfaceFrame(playerPos);
  const aiFrame = surfaceFrame(aiPos);
  const toAi = norm(sub(aiPos, scale(playerFrame.up, dot(aiPos, playerFrame.up))));
  const toPlayer = norm(sub(playerPos, scale(aiFrame.up, dot(playerPos, aiFrame.up))));

  const tanks: Record<TankId, TankState> = {
    player: makeTank('player', placement.player, bearingOf(playerFrame, toAi)),
    ai: makeTank('ai', placement.ai, bearingOf(aiFrame, toPlayer)),
  };

  const wind = rollWind(planet, tanks, makeRng(`${seed}:wind`));
  const match = new Match(seed, planet, tanks, wind, options.difficulty);
  options.onProgress?.({ fraction: 1, label: 'Ready' });
  return match;
}

/** A tangential breeze over the battlefield, so wind reads as horizontal where it matters. */
function rollWind(planet: Planet, tanks: Record<TankId, TankState>, rng: Rng): Vec3 {
  const mid = norm({
    x: tanks.player.dir.x + tanks.ai.dir.x,
    y: tanks.player.dir.y + tanks.ai.dir.y,
    z: tanks.player.dir.z + tanks.ai.dir.z,
  });
  const frame = surfaceFrame(mid);
  const bearing = rng.range(0, 360);
  const [min, max] = planet.preset.windRange;
  const magnitude = planet.preset.gravity * rng.range(min, max);
  return scale(aimDirection(frame, bearing, 0), magnitude);
}

interface Placement {
  player: Vec3;
  ai: Vec3;
}

/** Two dry, reasonably flat spots, far apart but inside artillery range of each other. */
function placeTanks(planet: Planet, rng: Rng, _difficulty: Difficulty): Placement {
  const candidates: Vec3[] = [];
  for (let i = 0; i < 4000 && candidates.length < 200; i++) {
    const d = randomDirection(rng);
    if (!isGoodGround(planet, d)) continue;
    candidates.push(d);
  }
  if (candidates.length < 2) {
    // Pathological world (almost no dry flat land): fall back to the two highest samples.
    const a = highestDirection(planet, rng);
    return { player: a, ai: rotateAbout(a, orthogonal(a), 1.0) };
  }

  const world = provisionalWorld(planet);
  let fallback: Placement | null = null;
  for (let attempt = 0; attempt < 60; attempt++) {
    const a = rng.pick(candidates);
    const b = rng.pick(candidates);
    const sep = angleBetween(a, b);
    if (sep < 0.5 || sep > 0.95) continue;
    const pa = planet.surfacePoint(a, false);
    const pb = planet.surfacePoint(b, false);
    if (!fallback) fallback = { player: a, ai: b };
    const tolerance = tuning.blastRadius * 1.4;
    if (isReachable(world, pa, pb, tolerance) && isReachable(world, pb, pa, tolerance)) {
      return { player: a, ai: b };
    }
  }
  if (fallback) return fallback;
  const a = candidates[0];
  return { player: a, ai: rotateAbout(a, orthogonal(a), 0.9) };
}

function provisionalWorld(planet: Planet): SimWorld {
  return {
    radius: planet.radius,
    seaLevel: planet.seaLevel,
    hasOcean: planet.hasOcean,
    gravity: planet.preset.gravity,
    muzzleScale: planet.preset.muzzleScale,
    wind: { x: 0, y: 0, z: 0 },
    heightAt: (d) => planet.heightAt(d),
    tanks: [],
  };
}

function isGoodGround(planet: Planet, dir: Vec3): boolean {
  const h = planet.heightAt(dir);
  if (planet.hasOcean && h < planet.seaLevel + 0.35) return false;
  if (h > planet.maxHeight - (planet.maxHeight - planet.seaLevel) * 0.12) return false;
  const normal = planet.normalAt(dir);
  return dot(normal, norm(dir)) > 0.9;
}

function highestDirection(planet: Planet, rng: Rng): Vec3 {
  let best = randomDirection(rng);
  let bestH = -Infinity;
  for (let i = 0; i < 500; i++) {
    const d = randomDirection(rng);
    const h = planet.heightAt(d);
    if (h > bestH) {
      bestH = h;
      best = d;
    }
  }
  return best;
}

function randomDirection(rng: Rng): Vec3 {
  const z = rng.range(-1, 1);
  const a = rng.range(0, Math.PI * 2);
  const r = Math.sqrt(Math.max(0, 1 - z * z));
  return { x: r * Math.cos(a), y: z, z: r * Math.sin(a) };
}

function orthogonal(v: Vec3): Vec3 {
  const ref: Vec3 = Math.abs(v.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
  return norm({
    x: v.y * ref.z - v.z * ref.y,
    y: v.z * ref.x - v.x * ref.z,
    z: v.x * ref.y - v.y * ref.x,
  });
}
