import { Noise3D, SeededRandom } from './prng';
import { PLANET_PRESETS, PlanetPresetDefinition, TuningConfig } from './tuning';
import {
  Crater,
  PlanetPresetId,
  TangentFrame,
  TankState,
  TurnOwner,
  Vec3,
  WindVector,
} from './types';

export function vec3(x: number, y: number, z: number): Vec3 {
  return { x, y, z };
}

export function addVec3(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function subVec3(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function scaleVec3(v: Vec3, s: number): Vec3 {
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}

export function dotVec3(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function crossVec3(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

export function lengthVec3(v: Vec3): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

export function distanceVec3(a: Vec3, b: Vec3): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function normalizeVec3(v: Vec3): Vec3 {
  const len = lengthVec3(v);
  if (len < 1e-8) {
    return { x: 0, y: 1, z: 0 };
  }
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

/**
 * Computes an orthonormal tangent basis (normal, north, east) at a given surface unit normal.
 */
export function computeTangentFrame(unitNormal: Vec3): TangentFrame {
  const normal = normalizeVec3(unitNormal);
  const worldUp = Math.abs(normal.y) > 0.94 ? vec3(1, 0, 0) : vec3(0, 1, 0);
  const east = normalizeVec3(crossVec3(worldUp, normal));
  const north = normalizeVec3(crossVec3(normal, east));
  return { normal, north, east };
}

export interface ProtectedFootprint {
  owner: TurnOwner;
  normal: Vec3;
  baseRadius: number;
  protectionRadius: number;
}

export class PlanetWorld {
  readonly seed: string;
  readonly presetId: PlanetPresetId;
  readonly preset: PlanetPresetDefinition;
  readonly baseRadius: number;
  readonly waterRadius: number;
  readonly terrainAmplitude: number;
  readonly terrainRoughness: number;
  readonly craters: Crater[] = [];
  readonly footprints: ProtectedFootprint[] = [];

  private readonly primaryNoise: Noise3D;
  private readonly detailNoise: Noise3D;
  private readonly ridgeNoise: Noise3D;

  constructor(
    seed: string,
    presetId: PlanetPresetId,
    tuning: TuningConfig,
    explicitRadius?: number,
  ) {
    this.seed = seed;
    this.presetId = presetId;
    this.preset = PLANET_PRESETS[presetId];

    const rng = new SeededRandom(`${seed}::planet`);
    const minR = Math.min(tuning.minPlanetRadius, tuning.maxPlanetRadius);
    const maxR = Math.max(tuning.minPlanetRadius, tuning.maxPlanetRadius);
    this.baseRadius =
      explicitRadius !== undefined ? explicitRadius : rng.range(minR, maxR);

    this.terrainAmplitude = tuning.terrainAmplitude;
    this.terrainRoughness = tuning.terrainRoughness;

    const effectiveWaterOffset = this.preset.hasWater ? tuning.waterLevelOffset : -999;
    this.waterRadius = this.baseRadius + effectiveWaterOffset;

    this.primaryNoise = new Noise3D(`${seed}::primary`);
    this.detailNoise = new Noise3D(`${seed}::detail`);
    this.ridgeNoise = new Noise3D(`${seed}::ridge`);
  }

  /**
   * Samples unmodified procedural terrain radius along a unit direction vector.
   */
  sampleBaseTerrainRadius(unitDir: Vec3): number {
    const r = this.terrainRoughness;
    const continent = this.primaryNoise.fbm(
      unitDir.x * r * 0.75,
      unitDir.y * r * 0.75,
      unitDir.z * r * 0.75,
      4,
      2.05,
      0.52,
    );

    const ridgeRaw = this.ridgeNoise.fbm(
      unitDir.x * r * 1.4,
      unitDir.y * r * 1.4,
      unitDir.z * r * 1.4,
      3,
      2.1,
      0.5,
    );
    const ridge = (1.0 - Math.abs(ridgeRaw) * 1.6) * 0.45;

    const detail =
      this.detailNoise.fbm(
        unitDir.x * r * 3.1,
        unitDir.y * r * 3.1,
        unitDir.z * r * 3.1,
        2,
        2.0,
        0.45,
      ) * 0.2;

    let combined = continent * 0.8 + ridge * 0.35 + detail;
    if (this.presetId === 'mars') {
      // Mars has deeper canyons and sharper plateaus
      combined = Math.sign(combined) * Math.pow(Math.abs(combined), 0.88);
    }

    let heightOffset = combined * this.terrainAmplitude;

    // Smoothly flatten right under tank footprints so tanks sit level
    for (const fp of this.footprints) {
      const chordDist = distanceVec3(unitDir, fp.normal) * this.baseRadius;
      if (chordDist < fp.protectionRadius * 1.15) {
        const t = Math.min(1, chordDist / (fp.protectionRadius * 1.15));
        const smooth = t * t * (3 - 2 * t);
        const targetOffset = fp.baseRadius - this.baseRadius;
        heightOffset = targetOffset * (1 - smooth) + heightOffset * smooth;
      }
    }

    return this.baseRadius + heightOffset;
  }

  /**
   * Samples terrain radius including all persistent craters carved so far.
   * Respects tank footprint protection so ground under a tank is never carved away.
   */
  sampleTerrainRadius(unitDir: Vec3): number {
    const n = normalizeVec3(unitDir);
    let radius = this.sampleBaseTerrainRadius(n);

    if (this.craters.length === 0) {
      return radius;
    }

    // Check if this surface point is protected by a tank footprint
    let footprintProtectionFactor = 1.0;
    for (const fp of this.footprints) {
      const surfaceDist = distanceVec3(n, fp.normal) * this.baseRadius;
      if (surfaceDist <= fp.protectionRadius * 0.65) {
        return radius; // Strictly uncarvable directly beneath tank
      }
      if (surfaceDist < fp.protectionRadius) {
        const ratio =
          (surfaceDist - fp.protectionRadius * 0.65) / (fp.protectionRadius * 0.35);
        footprintProtectionFactor = Math.min(
          footprintProtectionFactor,
          Math.max(0, Math.min(1, ratio)),
        );
      }
    }

    let totalCarve = 0;
    for (let i = 0; i < this.craters.length; i++) {
      const crater = this.craters[i];
      const worldPosOnBase = scaleVec3(n, radius);
      const dist = distanceVec3(worldPosOnBase, crater.position);
      if (dist < crater.radius) {
        const normalizedDist = dist / crater.radius;
        // Parabolic bowl with soft rim transition
        const bowl = 1.0 - normalizedDist * normalizedDist;
        const carveAmount = crater.depth * bowl * bowl;
        totalCarve += carveAmount;
      }
    }

    radius -= totalCarve * footprintProtectionFactor;
    const minCoreRadius = this.baseRadius * 0.45;
    return Math.max(minCoreRadius, radius);
  }

  /**
   * Effective collision radius (either solid ground or water surface if water covers the ground).
   */
  sampleSurfaceRadius(unitDir: Vec3): { radius: number; isWater: boolean } {
    const terrainRadius = this.sampleTerrainRadius(unitDir);
    if (this.preset.hasWater && terrainRadius <= this.waterRadius) {
      return { radius: this.waterRadius, isWater: true };
    }
    return { radius: terrainRadius, isWater: false };
  }

  /**
   * Registers a persistent crater if the impact was not on water and not strictly inside a tank footprint.
   * Note: Craters never heal, fade, or hit a cap (User Stories 26, 27, 28, 29).
   */
  carveCrater(
    impactPosition: Vec3,
    radius: number,
    depth: number,
    turn: number,
  ): Crater | null {
    const normal = normalizeVec3(impactPosition);
    const surface = this.sampleSurfaceRadius(normal);
    if (surface.isWater) {
      return null; // Water impacts splash instead of carving seabed
    }

    // Check if impact centre is directly under a tank's core footprint
    for (const fp of this.footprints) {
      const surfaceDist = distanceVec3(normal, fp.normal) * this.baseRadius;
      if (surfaceDist < fp.protectionRadius * 0.6) {
        return null;
      }
    }

    const crater: Crater = {
      id: `crater-${turn}-${this.craters.length + 1}`,
      position: scaleVec3(normal, surface.radius),
      normal,
      radius,
      depth,
      createdAtTurn: turn,
    };

    this.craters.push(crater);
    return crater;
  }

  /**
   * Computes RGB [0..1] vertex colour for a point on the terrain surface.
   */
  sampleTerrainColor(unitDir: Vec3, terrainRadius: number): [number, number, number] {
    const relHeight = (terrainRadius - this.baseRadius) / this.terrainAmplitude;

    // Check if inside a crater to darken into scorched earth / basalt
    let scorchFactor = 0;
    const pos = scaleVec3(unitDir, terrainRadius);
    for (let i = 0; i < this.craters.length; i++) {
      const c = this.craters[i];
      const d = distanceVec3(pos, c.position);
      if (d < c.radius * 0.92) {
        const f = 1 - d / (c.radius * 0.92);
        scorchFactor = Math.max(scorchFactor, Math.min(0.82, f * 1.1));
      }
    }

    let r = 0.5;
    let g = 0.5;
    let b = 0.5;

    if (this.presetId === 'earth') {
      const waterDelta = terrainRadius - this.waterRadius;
      if (waterDelta < -0.5) {
        // Deep seabed
        r = 0.09;
        g = 0.25;
        b = 0.42;
      } else if (waterDelta < 0.38) {
        // Coastal sand / beach
        r = 0.82;
        g = 0.76;
        b = 0.54;
      } else if (relHeight < 0.25) {
        // Lush green lowlands
        r = 0.22;
        g = 0.56;
        b = 0.24;
      } else if (relHeight < 0.52) {
        // Upland forest & olive hills
        r = 0.36;
        g = 0.46;
        b = 0.23;
      } else if (relHeight < 0.76) {
        // Rocky brown mountains
        r = 0.47;
        g = 0.41;
        b = 0.34;
      } else {
        // Alpine snow peaks
        r = 0.93;
        g = 0.95;
        b = 0.98;
      }
    } else {
      // Mars-like rust/ochre/basalt palette
      if (relHeight < -0.35) {
        // Dark basalt basin
        r = 0.38;
        g = 0.2;
        b = 0.14;
      } else if (relHeight < 0.15) {
        // Rust red plains
        r = 0.72;
        g = 0.33;
        b = 0.19;
      } else if (relHeight < 0.58) {
        // Dusty ochre highlands
        r = 0.84;
        g = 0.46;
        b = 0.25;
      } else {
        // Sun-bleached rim peaks & frost dust
        r = 0.91;
        g = 0.67;
        b = 0.48;
      }
    }

    if (scorchFactor > 0) {
      const charR = 0.14;
      const charG = 0.12;
      const charB = 0.11;
      r = r * (1 - scorchFactor) + charR * scorchFactor;
      g = g * (1 - scorchFactor) + charG * scorchFactor;
      b = b * (1 - scorchFactor) + charB * scorchFactor;
    }

    return [r, g, b];
  }
}

/**
 * Places Player and AI tanks on opposite sides of the planet (angular separation 95°..155°)
 * on dry land above water level, orienting each tank initially toward the hemisphere of the other.
 */
export function placeTanksOnPlanet(
  planet: PlanetWorld,
  tuning: TuningConfig,
  demoMode = false,
): Record<TurnOwner, TankState> {
  const rng = new SeededRandom(`${planet.seed}::tanks`);

  const findValidNormal = (
    preferredDir: Vec3,
    minAngleRadFromOther?: { normal: Vec3; minRad: number; maxRad: number },
  ): Vec3 => {
    let bestCandidate = normalizeVec3(preferredDir);
    let bestScore = -Infinity;

    for (let attempt = 0; attempt < 180; attempt++) {
      const candidate =
        attempt === 0
          ? normalizeVec3(preferredDir)
          : normalizeVec3({
              x: rng.gaussian(0, 1),
              y: rng.gaussian(0, 0.72), // Prefer mid-latitudes away from extreme poles
              z: rng.gaussian(0, 1),
            });

      if (Math.abs(candidate.y) > 0.82) {
        continue;
      }

      if (minAngleRadFromOther) {
        const dot = Math.max(
          -1,
          Math.min(1, dotVec3(candidate, minAngleRadFromOther.normal)),
        );
        const angle = Math.acos(dot);
        if (
          angle < minAngleRadFromOther.minRad ||
          angle > minAngleRadFromOther.maxRad
        ) {
          continue;
        }
      }

      const rawRadius = planet.sampleBaseTerrainRadius(candidate);
      const isDry = !planet.preset.hasWater || rawRadius > planet.waterRadius + 0.55;
      if (!isDry) {
        continue;
      }

      // Prefer moderate elevation (not submerged, not extreme spike)
      const rel = Math.abs(rawRadius - planet.baseRadius) / planet.terrainAmplitude;
      const score = (isDry ? 100 : 0) - rel * 10 - Math.abs(candidate.y) * 5;
      if (score > bestScore) {
        bestScore = score;
        bestCandidate = candidate;
        if (attempt > 25 && score > 90) {
          break;
        }
      }
    }

    return bestCandidate;
  };

  const playerNormal = findValidNormal(vec3(0, 0.15, 1));
  const targetMinRad = (95 * Math.PI) / 180;
  const targetMaxRad = (155 * Math.PI) / 180;
  const aiNormal = findValidNormal(vec3(-playerNormal.x, 0.1, -playerNormal.z), {
    normal: playerNormal,
    minRad: targetMinRad,
    maxRad: targetMaxRad,
  });

  // Register footprints and flatten immediate pads
  const playerBaseR = Math.max(
    planet.sampleBaseTerrainRadius(playerNormal),
    planet.preset.hasWater ? planet.waterRadius + 0.65 : 0,
  );
  const aiBaseR = Math.max(
    planet.sampleBaseTerrainRadius(aiNormal),
    planet.preset.hasWater ? planet.waterRadius + 0.65 : 0,
  );

  planet.footprints.push(
    {
      owner: 'player',
      normal: playerNormal,
      baseRadius: playerBaseR,
      protectionRadius: tuning.tankFootprintRadius,
    },
    {
      owner: 'ai',
      normal: aiNormal,
      baseRadius: aiBaseR,
      protectionRadius: tuning.tankFootprintRadius,
    },
  );

  const playerRadius = planet.sampleTerrainRadius(playerNormal);
  const aiRadius = planet.sampleTerrainRadius(aiNormal);

  const playerFrame = computeTangentFrame(playerNormal);
  const aiFrame = computeTangentFrame(aiNormal);

  const computeInitialBearingToward = (
    fromFrame: TangentFrame,
    toPos: Vec3,
  ): number => {
    const fromPos = scaleVec3(fromFrame.normal, planet.baseRadius);
    const chord = subVec3(toPos, fromPos);
    const northComp = dotVec3(chord, fromFrame.north);
    const eastComp = dotVec3(chord, fromFrame.east);
    const deg = (Math.atan2(eastComp, northComp) * 180) / Math.PI;
    return ((deg % 360) + 360) % 360;
  };

  const playerPos = scaleVec3(playerNormal, playerRadius);
  const aiPos = scaleVec3(aiNormal, aiRadius);

  const playerBearing = Math.round(computeInitialBearingToward(playerFrame, aiPos));
  const aiBearing = Math.round(computeInitialBearingToward(aiFrame, playerPos));

  return {
    player: {
      id: 'player',
      name: demoMode ? 'Vanguard-1 (AI)' : 'Vanguard-1 (You)',
      color: '#38bdf8',
      normal: playerNormal,
      position: playerPos,
      frame: playerFrame,
      bearingDeg: playerBearing,
      elevationDeg: 42,
      lastPower: tuning.defaultFirstShotPower,
      health: tuning.tankMaxHealth,
      maxHealth: tuning.tankMaxHealth,
      footprintRadius: tuning.tankFootprintRadius,
    },
    ai: {
      id: 'ai',
      name: 'Ares Automaton (AI)',
      color: '#f97316',
      normal: aiNormal,
      position: aiPos,
      frame: aiFrame,
      bearingDeg: aiBearing,
      elevationDeg: 45,
      lastPower: tuning.defaultFirstShotPower,
      health: tuning.tankMaxHealth,
      maxHealth: tuning.tankMaxHealth,
      footprintRadius: tuning.tankFootprintRadius,
    },
  };
}

/**
 * Generates deterministic initial wind or slightly shifts wind between turns.
 */
export function generateWindForTurn(
  seed: string,
  turn: number,
  presetId: PlanetPresetId,
  tuning: TuningConfig,
): WindVector {
  const rng = new SeededRandom(`${seed}::wind::${turn}`);
  const preset = PLANET_PRESETS[presetId];
  const directionDeg = Math.round(rng.range(0, 360));
  const rawStrength = rng.range(0.4, preset.windMaxStrength) * tuning.windScale;
  const strength = Math.round(rawStrength * 10) / 10;

  const rad = (directionDeg * Math.PI) / 180;
  const axis = normalizeVec3({
    x: Math.sin(rad),
    y: Math.cos(rad) * 0.35,
    z: Math.cos(rad),
  });

  return {
    directionDeg,
    strength,
    axis,
  };
}
