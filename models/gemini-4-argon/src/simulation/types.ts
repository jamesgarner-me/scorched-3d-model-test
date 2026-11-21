export type PlanetPresetId = 'earth' | 'mars';

export type AiDifficulty = 'easy' | 'medium' | 'hard';

export type TuningClassification = 'live' | 'next-shot' | 'regenerate' | 'new-match';

export type GamePhase =
  | 'loading'
  | 'flyover'
  | 'aiming'
  | 'charging'
  | 'flight'
  | 'impact'
  | 'destruction'
  | 'gameover';

export type TurnOwner = 'player' | 'ai';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface TangentFrame {
  normal: Vec3; // Radial outward unit vector (up)
  north: Vec3; // Unit tangent vector pointing toward north pole
  east: Vec3; // Unit tangent vector pointing east
}

export interface WindVector {
  /** Angular direction in degrees (0 = North, 90 = East, 180 = South, 270 = West) */
  directionDeg: number;
  /** Wind speed magnitude in m/s^2 acceleration equivalent */
  strength: number;
  /** 3D reference vector on the planet equator/global frame for consistent wind pushing */
  axis: Vec3;
}

export interface Crater {
  id: string;
  position: Vec3;
  normal: Vec3;
  radius: number;
  depth: number;
  createdAtTurn: number;
}

export interface TankState {
  id: TurnOwner;
  name: string;
  color: string;
  /** Unit normal on sphere surface where tank sits */
  normal: Vec3;
  /** World space surface position of tank base */
  position: Vec3;
  /** Local tangent coordinate frame at tank position */
  frame: TangentFrame;
  /** Turret horizontal bearing in degrees [0, 360) relative to local North */
  bearingDeg: number;
  /** Cannon vertical elevation in degrees [5, 85] above local tangent plane */
  elevationDeg: number;
  /** Last fired power percentage [10, 100] (defaults to 55 on turn 1) */
  lastPower: number;
  /** Current health points [0, maxHealth] */
  health: number;
  maxHealth: number;
  /** Protected footprint radius where terrain cannot be carved away */
  footprintRadius: number;
}

export interface ShotInput {
  shooterId: TurnOwner;
  bearingDeg: number;
  elevationDeg: number;
  power: number; // 10..100
  /** Deterministic seed or 0 for no variance (e.g. trajectory preview) */
  varianceSeed?: string | null;
}

export interface TrajectoryPoint {
  position: Vec3;
  velocity: Vec3;
  time: number;
  altitude: number;
}

export interface ImpactOutcome {
  hitPoint: Vec3;
  hitNormal: Vec3;
  hitWater: boolean;
  craterCreated: Crater | null;
  damages: Record<TurnOwner, number>;
  directHit: boolean;
  killedTank: TurnOwner | null;
}

export interface SimulationResult {
  points: TrajectoryPoint[];
  previewPoints: Vec3[];
  impactPosition: Vec3;
  impactNormal: Vec3;
  hitWater: boolean;
  flightDuration: number;
  appliedBearingDeg: number;
  appliedElevationDeg: number;
  appliedPower: number;
}

export interface AiShotMemory {
  turn: number;
  bearingDeg: number;
  elevationDeg: number;
  power: number;
  impactPoint: Vec3;
  targetPoint: Vec3;
  angularErrorDeg: number;
  overshotRad: number;
}

export interface PerformanceMetrics {
  fps: number;
  frameTimeMs: number;
  generationTimeMs: number;
  aiSolveTimeMs: number;
  craterUpdateTimeMs: number;
}
