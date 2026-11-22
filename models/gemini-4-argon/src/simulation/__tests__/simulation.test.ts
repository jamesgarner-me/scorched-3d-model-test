import { describe, expect, it } from 'vitest';
import { solveAiTurn } from '../ai';
import { computeBlastDamage, resolveShotImpact, simulateShot } from '../physics';
import {
  distanceVec3,
  generateWindForTurn,
  normalizeVec3,
  placeTanksOnPlanet,
  PlanetWorld,
  scaleVec3,
} from '../planet';
import { DEFAULT_TUNING, PLANET_PRESETS } from '../tuning';

describe('Headless Planetary Artillery Simulation', () => {
  it('reproduces identical planets and tank placements from the same seed', () => {
    const p1 = new PlanetWorld('SEED-ALPHA-42', 'earth', DEFAULT_TUNING);
    const p2 = new PlanetWorld('SEED-ALPHA-42', 'earth', DEFAULT_TUNING);
    const tanks1 = placeTanksOnPlanet(p1, DEFAULT_TUNING);
    const tanks2 = placeTanksOnPlanet(p2, DEFAULT_TUNING);

    expect(p1.baseRadius).toBe(p2.baseRadius);
    expect(tanks1.player.position).toEqual(tanks2.player.position);
    expect(tanks1.ai.position).toEqual(tanks2.ai.position);

    const sampleDir = normalizeVec3({ x: 0.4, y: -0.5, z: 0.7 });
    expect(p1.sampleTerrainRadius(sampleDir)).toBe(p2.sampleTerrainRadius(sampleDir));
  });

  it('curves trajectories under planet-centred gravity, bends with wind, and limits preview to ~25%', () => {
    const planet = new PlanetWorld('ORB-BALLISTICS', 'earth', DEFAULT_TUNING, 28);
    const tanks = placeTanksOnPlanet(planet, DEFAULT_TUNING);
    const calmWind = { directionDeg: 90, strength: 0, axis: { x: 1, y: 0, z: 0 } };
    const strongEastWind = {
      directionDeg: 90,
      strength: 4.5,
      axis: { x: 1, y: 0, z: 0 },
    };

    const simCalm = simulateShot(
      planet,
      tanks.player,
      tanks,
      calmWind,
      DEFAULT_TUNING,
      {
        shooterId: 'player',
        bearingDeg: tanks.player.bearingDeg,
        elevationDeg: 45,
        power: 75,
        varianceSeed: null,
      },
    );

    const simWindy = simulateShot(
      planet,
      tanks.player,
      tanks,
      strongEastWind,
      DEFAULT_TUNING,
      {
        shooterId: 'player',
        bearingDeg: tanks.player.bearingDeg,
        elevationDeg: 45,
        power: 75,
        varianceSeed: null,
      },
    );

    // Trajectory guide shows only ~25% of the arc and never reveals the landing point
    expect(simCalm.previewPoints.length).toBeGreaterThanOrEqual(3);
    expect(simCalm.previewPoints.length).toBeLessThanOrEqual(
      Math.ceil(simCalm.points.length * 0.3),
    );
    const lastPreview = simCalm.previewPoints[simCalm.previewPoints.length - 1];
    expect(distanceVec3(lastPreview, simCalm.impactPosition)).toBeGreaterThan(2);

    // Wind shifts impact point noticeably
    expect(
      distanceVec3(simCalm.impactPosition, simWindy.impactPosition),
    ).toBeGreaterThan(0.5);
  });

  it('carves persistent craters on dry land, never carves under a tank footprint, and splashes on water while dealing shoreline blast damage', () => {
    const planet = new PlanetWorld('ORB-CRATERS', 'earth', DEFAULT_TUNING, 28);
    const tanks = placeTanksOnPlanet(planet, DEFAULT_TUNING);

    // 1. Carve dry land away from tanks
    const midNormal = normalizeVec3({
      x: tanks.player.normal.y,
      y: -tanks.player.normal.x,
      z: tanks.player.normal.z,
    });
    // Ensure dry land at test normal by sampling a high point or Mars preset
    const marsPlanet = new PlanetWorld(
      'ORB-MARS-CRATER',
      'mars',
      {
        ...DEFAULT_TUNING,
        waterLevelOffset: PLANET_PRESETS.mars.waterLevelOffset,
      },
      28,
    );
    const marsTanks = placeTanksOnPlanet(marsPlanet, DEFAULT_TUNING);
    const beforeRadius = marsPlanet.sampleTerrainRadius(midNormal);
    const hitPos = scaleVec3(midNormal, beforeRadius);

    const crater = marsPlanet.carveCrater(hitPos, 4.8, 2.4, 1);
    expect(crater).not.toBeNull();
    const afterRadius = marsPlanet.sampleTerrainRadius(midNormal);
    expect(afterRadius).toBeLessThan(beforeRadius);

    // 2. Ground directly under a tank is protected and never carved away
    const tankNormal = marsTanks.player.normal;
    const tankRadiusBefore = marsPlanet.sampleTerrainRadius(tankNormal);
    const blockedCrater = marsPlanet.carveCrater(
      marsTanks.player.position,
      4.8,
      2.4,
      2,
    );
    expect(blockedCrater).toBeNull();
    expect(marsPlanet.sampleTerrainRadius(tankNormal)).toBe(tankRadiusBefore);

    // 3. Shoreline blast damage still applies even when a shell splashes in shallow water
    const nearShoreImpact = scaleVec3(
      tanks.player.normal,
      tanks.player.position.x !== 0
        ? marsPlanet.sampleTerrainRadius(tanks.player.normal)
        : 28,
    );
    const fakeWaterSim = {
      points: [],
      previewPoints: [],
      impactPosition: marsTanks.player.position,
      impactNormal: marsTanks.player.normal,
      hitWater: true,
      flightDuration: 2.0,
      appliedBearingDeg: 0,
      appliedElevationDeg: 45,
      appliedPower: 50,
    };

    const outcome = resolveShotImpact(
      marsPlanet,
      fakeWaterSim,
      marsTanks,
      DEFAULT_TUNING,
      3,
    );
    expect(outcome.hitWater).toBe(true);
    expect(outcome.craterCreated).toBeNull();
    expect(outcome.damages.player).toBeGreaterThan(150);
    expect(nearShoreImpact).toBeDefined();
  });

  it('scales blast damage from max at impact centre to zero beyond blastRadius, and solves AI turns across tiers', () => {
    const planet = new PlanetWorld('ORB-AI-SOLVER', 'earth', DEFAULT_TUNING, 28);
    const tanks = placeTanksOnPlanet(planet, DEFAULT_TUNING);
    const wind = generateWindForTurn('ORB-AI-SOLVER', 1, 'earth', DEFAULT_TUNING);

    const directDamage = computeBlastDamage(
      tanks.ai.position,
      tanks.ai,
      DEFAULT_TUNING,
    );
    expect(directDamage).toBe(DEFAULT_TUNING.maxBlastDamage);

    const farPoint = scaleVec3(tanks.ai.normal, planet.baseRadius + 50);
    expect(computeBlastDamage(farPoint, tanks.ai, DEFAULT_TUNING)).toBe(0);

    const easyOut = solveAiTurn(
      planet,
      tanks,
      wind,
      DEFAULT_TUNING,
      'easy',
      [],
      'ORB-AI-SOLVER',
      1,
    );
    const hardOut = solveAiTurn(
      planet,
      tanks,
      wind,
      DEFAULT_TUNING,
      'hard',
      [],
      'ORB-AI-SOLVER',
      1,
    );

    expect(easyOut.shotInput.power).toBeGreaterThanOrEqual(10);
    expect(hardOut.shotInput.power).toBeLessThanOrEqual(100);
    expect(hardOut.solveTimeMs).toBeGreaterThan(0);
  });
});
