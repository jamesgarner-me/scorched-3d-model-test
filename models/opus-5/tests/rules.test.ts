import { beforeAll, describe, expect, it } from 'vitest';
import { decideShot, solveAim, type Difficulty } from '../src/game/ai';
import { createMatch, type Match } from '../src/game/match';
import { generatePlanet } from '../src/game/planet';
import { tuning } from '../src/game/tuning';
import { angleBetween, dist, len, norm, rotateAbout, type Vec3 } from '../src/game/vec';

/** A dry, high spot well clear of the waterline, so carving has room to bite. */
function findHighGround(match: Match): Vec3 {
  let best = match.tanks.player.dir;
  let bestHeight = -Infinity;
  for (let i = 0; i < 4000; i++) {
    const z = -1 + (2 * (i % 89)) / 88;
    const a = (i * 2.399963) % (Math.PI * 2);
    const r = Math.sqrt(Math.max(0, 1 - z * z));
    const d = { x: r * Math.cos(a), y: z, z: r * Math.sin(a) };
    const h = match.planet.heightAt(d);
    if (h > bestHeight) {
      bestHeight = h;
      best = d;
    }
  }
  return best;
}

// Small grids keep the suite quick; nothing under test depends on resolution.
beforeAll(() => {
  tuning.gridResolution = 64;
});

const newMatch = (seed: string, preset: 'earth' | 'mars' = 'earth', difficulty: Difficulty = 'hard') =>
  createMatch({ seed, preset, difficulty });

function findWater(match: Match): Vec3 | null {
  for (let i = 0; i < 8000; i++) {
    const z = -1 + (2 * (i % 97)) / 96;
    const a = (i * 2.399963) % (Math.PI * 2);
    const r = Math.sqrt(Math.max(0, 1 - z * z));
    const d = { x: r * Math.cos(a), y: z, z: r * Math.sin(a) };
    if (match.planet.isWater(d)) return d;
  }
  return null;
}

describe('planet generation', () => {
  it('is fully determined by its seed', async () => {
    const a = await generatePlanet({ seed: 'REPEAT', preset: 'earth' });
    const b = await generatePlanet({ seed: 'REPEAT', preset: 'earth' });
    const c = await generatePlanet({ seed: 'OTHER', preset: 'earth' });
    expect(a.radius).toBe(b.radius);
    expect(a.seaLevel).toBe(b.seaLevel);
    expect(Array.from(a.heights[0])).toEqual(Array.from(b.heights[0]));
    expect(Array.from(a.heights[0])).not.toEqual(Array.from(c.heights[0]));
  });

  it('gives Earth an ocean and Mars none', async () => {
    const earth = await generatePlanet({ seed: 'WORLDS', preset: 'earth' });
    const mars = await generatePlanet({ seed: 'WORLDS', preset: 'mars' });
    expect(earth.hasOcean).toBe(true);
    expect(earth.seaLevel).toBeGreaterThan(earth.minHeight);
    expect(earth.seaLevel).toBeLessThan(earth.maxHeight);
    expect(mars.hasOcean).toBe(false);
    expect(mars.seaLevel).toBeLessThan(mars.minHeight);
  });

  it('varies radius between matches so curvature changes', async () => {
    const radii = new Set<number>();
    for (const seed of ['R1', 'R2', 'R3', 'R4', 'R5', 'R6']) {
      radii.add((await generatePlanet({ seed, preset: 'earth' })).radius);
    }
    expect(radii.size).toBeGreaterThan(1);
  });

  it('reports real progress while generating', async () => {
    const fractions: number[] = [];
    await generatePlanet({ seed: 'PROGRESS', preset: 'earth' }, (p) => fractions.push(p.fraction));
    expect(fractions.length).toBeGreaterThan(3);
    expect(fractions[fractions.length - 1]).toBe(1);
    for (let i = 1; i < fractions.length; i++) {
      expect(fractions[i]).toBeGreaterThanOrEqual(fractions[i - 1]);
    }
  });
});

describe('craters', () => {
  it('only ever removes terrain, and never heals or fades', async () => {
    const match = await newMatch('CRATER');
    const planet = match.planet;
    const spot = findHighGround(match);
    const before = planet.heightAt(spot);
    planet.carve(spot, 10, 0.6);
    const after = planet.heightAt(spot);
    expect(after).toBeLessThan(before);

    // A second hit on the same ground deepens it further — craters are not capped.
    planet.carve(spot, 10, 0.6);
    const deeper = planet.heightAt(spot);
    expect(deeper).toBeLessThan(after);

    // And nothing anywhere rises again over time; there is no healing path at all.
    const snapshot = Array.from(planet.heights[0]);
    for (let i = 0; i < 15; i++) {
      planet.carve(rotateAbout(spot, norm({ x: -spot.y, y: spot.x, z: 0.3 }), 0.05 * i), 8, 0.5);
    }
    planet.heights[0].forEach((h, i) => expect(h).toBeLessThanOrEqual(snapshot[i] + 1e-6));
    expect(planet.craterCount).toBeGreaterThan(10);
  });

  it('leaves the ground under a tank intact so it can never be left floating', async () => {
    const match = await newMatch('FOOTPRINT');
    const planet = match.planet;
    const target = match.tanks.ai;
    const before = planet.heightAt(target.dir);
    // Detonate directly on top of the enemy tank.
    match.resolveImpact('player', {
      kind: 'terrain',
      position: match.bodyCentre('ai'),
      dir: norm(match.bodyCentre('ai')),
    });
    expect(planet.heightAt(target.dir)).toBeCloseTo(before, 5);
    // It still took heavy damage — the tank is killed by blast, not by the ground.
    expect(target.health).toBeLessThan(target.maxHealth);
  });

  it('splashes in water instead of dredging the seabed', async () => {
    const match = await newMatch('SPLASH');
    const water = findWater(match);
    expect(water).not.toBeNull();
    const planet = match.planet;
    const before = planet.heightAt(water!);
    const craters = planet.craterCount;
    match.resolveImpact('player', {
      kind: 'water',
      position: { x: water!.x * planet.seaLevel, y: water!.y * planet.seaLevel, z: water!.z * planet.seaLevel },
      dir: water!,
    });
    expect(planet.heightAt(water!)).toBe(before);
    expect(planet.craterCount).toBe(craters);
  });

  it('never carves land below the waterline', async () => {
    const match = await newMatch('SHORE');
    const planet = match.planet;
    const spot = rotateAbout(match.tanks.player.dir, norm(match.tanks.ai.dir), 1.2);
    for (let i = 0; i < 12; i++) planet.carve(spot, 12, 3);
    expect(planet.heightAt(spot)).toBeGreaterThanOrEqual(planet.seaLevel - 1e-3);
  });
});

describe('the shared simulation', () => {
  it('makes the guide and the fired shell agree exactly when variance is off', async () => {
    const match = await newMatch('SHARED');
    const variance = tuning.shotVariance;
    tuning.shotVariance = 0;
    try {
      const aim = { bearing: 42, elevation: 33, power: 61 };
      const preview = match.previewPath('player', aim);
      const fired = match.launch('player', aim);
      expect(fired.points.length).toBe(preview.points.length);
      expect(fired.impact?.position).toEqual(preview.impact?.position);
    } finally {
      tuning.shotVariance = variance;
    }
  });

  it('shows only the opening slice of the arc, never the landing point', async () => {
    const match = await newMatch('GUIDE');
    const aim = { bearing: match.tanks.player.bearing, elevation: 35, power: 65 };
    const path = match.previewPath('player', aim);
    expect(path.impact).not.toBeNull();
    const shown = Math.floor(path.points.length * tuning.guideFraction);
    expect(shown).toBeGreaterThan(1);
    expect(shown).toBeLessThan(path.points.length);
    const lastShown = path.points[shown - 1];
    // The revealed tip is still high in the air and nowhere near the impact.
    expect(len(lastShown)).toBeGreaterThan(match.planet.radius);
    expect(dist(lastShown, path.impact!.position)).toBeGreaterThan(tuning.blastRadius);
  });
});

describe('match rules', () => {
  it('places both tanks on dry, mutually reachable ground', async () => {
    for (const seed of ['P1', 'P2', 'P3', 'P4']) {
      const match = await newMatch(seed);
      const { player, ai } = match.tanks;
      expect(match.planet.isWater(player.dir)).toBe(false);
      expect(match.planet.isWater(ai.dir)).toBe(false);
      const separation = angleBetween(player.position, ai.position);
      expect(separation).toBeGreaterThan(0.3);
      const solution = solveAim(match.world(), player.position, match.bodyCentre('ai'));
      expect(solution.missDistance).toBeLessThan(tuning.blastRadius * 2);
    }
  });

  it('gives the player the first turn and then alternates', async () => {
    const match = await newMatch('TURNS');
    expect(match.turn).toBe('player');
    expect(match.endTurn()).toBe('ai');
    expect(match.round).toBe(1);
    expect(match.endTurn()).toBe('player');
    expect(match.round).toBe(2);
  });

  it('ends the match when a tank reaches zero health', async () => {
    const match = await newMatch('FINISH');
    const impact = { kind: 'tank' as const, position: match.bodyCentre('ai'), dir: norm(match.bodyCentre('ai')), tankId: 'ai' as const };
    match.resolveImpact('player', impact);
    expect(match.winner).toBeNull();
    expect(match.tanks.ai.health).toBeLessThan(match.tanks.ai.maxHealth);
    match.resolveImpact('player', impact);
    expect(match.tanks.ai.health).toBe(0);
    expect(match.winner).toBe('player');
  });

  it('reports wind as a bearing and a normalised strength', async () => {
    const match = await newMatch('WIND');
    const readout = match.windReadout();
    expect(readout.bearing).toBeGreaterThanOrEqual(0);
    expect(readout.bearing).toBeLessThan(360);
    expect(readout.strength).toBeGreaterThanOrEqual(0);
    expect(readout.strength).toBeLessThanOrEqual(1);
    expect(readout.magnitude).toBeCloseTo(len(match.wind), 6);
  });
});

describe('the AI', () => {
  it('solves a hit with the same physics the player uses', async () => {
    for (const preset of ['earth', 'mars'] as const) {
      const match = await newMatch(`AI-${preset}`, preset);
      const solution = solveAim(match.world(), match.tanks.ai.position, match.bodyCentre('player'));
      const outcome = match.fire('ai', solution);
      expect(outcome.damage).not.toBeNull();
      expect(outcome.damage!.distanceToTarget).toBeLessThan(tuning.blastRadius);
    }
  });

  it('misses further on Easy than on Hard, and walks its shots in', async () => {
    const firstMiss: Record<Difficulty, number> = { easy: 0, medium: 0, hard: 0 };
    const seeds = ['W1', 'W2', 'W3', 'W4'];
    for (const difficulty of ['easy', 'medium', 'hard'] as Difficulty[]) {
      let total = 0;
      for (const seed of seeds) {
        const match = await newMatch(seed, 'earth', difficulty);
        const decision = decideShot(
          match.world(),
          match.tanks.ai.position,
          match.bodyCentre('player'),
          match.aiMemory,
        );
        const outcome = match.fire('ai', decision.aim);
        total += outcome.damage?.distanceToTarget ?? 100;
      }
      firstMiss[difficulty] = total / seeds.length;
    }
    expect(firstMiss.easy).toBeGreaterThan(firstMiss.medium);
    expect(firstMiss.medium).toBeGreaterThan(firstMiss.hard);
  });

  it('shrinks its standing aim error after every shot', async () => {
    const match = await newMatch('LEARN', 'earth', 'medium');
    const before = match.aiMemory.errorScale;
    match.noteAiResult(30);
    match.noteAiResult(18);
    expect(match.aiMemory.errorScale).toBeLessThan(before);
    expect(match.aiMemory.shots).toBe(2);
    expect(match.aiMemory.lastMiss).toBe(18);
  });

  it('plays a whole match to a winner without stalling', async () => {
    const match = await newMatch('FULL', 'earth', 'medium');
    let rounds = 0;
    while (!match.winner && rounds < 40) {
      rounds++;
      const solution = solveAim(match.world(), match.tanks.player.position, match.bodyCentre('ai'));
      match.fire('player', solution);
      if (match.winner) break;
      const decision = decideShot(match.world(), match.tanks.ai.position, match.bodyCentre('player'), match.aiMemory);
      const outcome = match.fire('ai', decision.aim);
      if (outcome.damage) match.noteAiResult(outcome.damage.distanceToTarget);
      match.endTurn();
      match.endTurn();
    }
    expect(match.winner).not.toBeNull();
    expect(rounds).toBeLessThan(40);
    expect(match.planet.craterCount).toBeGreaterThan(0);
  });
});
