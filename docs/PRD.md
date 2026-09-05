# PRD: Planetary Artillery MVP

Status: ready-for-agent

## Problem Statement

I want to play a short, good-looking 3D artillery duel in my browser without
installing anything, logging in, or waiting on a server. The classic
angle-and-power artillery loop is fun, but flat-terrain versions feel dated and
the tactical space is shallow. I want the *planet itself* — its curvature,
gravity, wind, and terrain — to be the puzzle: I should have to think about
firing over the horizon of a small world, leading a shot into the wind, and
carving the ground out from a hillside my opponent is hiding behind. I want each
match to look distinct, last about five minutes, and end with a satisfying
explosion — all against an AI that feels like it's genuinely aiming, not
cheating.

## Solution

A fully client-side, turn-based 3D artillery game. Each match procedurally
generates a spherical **Planet** (Earth-like or Mars-like **Preset**) and places
one player **Tank** and one AI **Tank** far apart on valid terrain. On your
**Turn** you orbit the camera to read the world, adjust turret **Bearing** and
**Elevation** with the arrow keys, hold Space to build **Power**, and release to
fire a single **Shot**. The projectile follows a ballistic arc bent by
planet-centred gravity and **Wind**; a translucent **Trajectory guide** previews
roughly the first quarter of the arc. Impacts deal **Blast** damage that falls
off with distance and carve persistent **Craters** into the terrain — except
under a **Tank footprint** and on **Water**, which only splashes. A three-tier AI
uses the same physics, learns from its own misses, and misses believably. The
match ends when a tank hits zero health, with a cinematic destruction sequence
and a winner overlay offering a fresh match. A development-only debug panel
exposes the tuning surface live.

## User Stories

1. As a player, I want to start a match without any backend, account, or install, so that I can play instantly in my Chromium browser.
2. As a player, I want each match to generate a fresh, procedurally created planet, so that matches feel distinct.
3. As a player, I want to choose between an Earth-like and a Mars-like planet preset, so that I can play worlds with different gravity, wind, and looks.
4. As a player, I want the Earth-like preset to show water, green/brown land, haze, clouds, and snow on high terrain, so that it reads as a living world.
5. As a player, I want the Mars-like preset to show red/rust dry terrain with a dusty atmosphere and little or no water, so that it feels distinct from Earth-like.
6. As a player, I want planet radius to vary between matches, so that curvature and shot range change the tactical problem.
7. As a player, I want a loading screen with a visible progress indicator during generation, so that the ~5–10s wait never feels frozen.
8. As a player, I want a brief cinematic flyover of the generated planet before play, so that I can take in its shape and terrain.
9. As a player, I want the camera to settle on my tank and indicate my turn, so that I know it's time to aim.
10. As a player, I want to freely orbit, pan, and zoom the camera around the planet, so that I can inspect terrain and find the enemy tank.
11. As a player, I want camera movement to feel smooth and responsive rather than draggy, so that reading the world is pleasant.
12. As a player, I want to adjust turret bearing with the left/right arrow keys, so that I can aim horizontally.
13. As a player, I want to adjust cannon elevation with the up/down arrow keys, so that I can aim vertically.
14. As a player, I want to hold arrow keys for continuous, smooth turret adjustment, so that fine aiming is comfortable.
15. As a player, I want to hold Space to charge power and release to fire, so that shot strength is a timing skill.
16. As a player, I want a visible power meter while charging, so that I can judge my release.
17. As a player, I want a trajectory guide that emerges from the cannon and updates as I change aim and power, so that I can plan a shot.
18. As a player, I want the guide to show only about the first 25% of the arc and never the landing point, so that aiming stays skill-based.
19. As a player, I want the guide, before I start charging, to reflect my last shot's power (a mid-range default on the first shot), so that I can range in from a known baseline.
20. As a player, I want my shot to curve under planet-centred gravity rather than fall along a fixed axis, so that firing around a curved world works.
21. As a player, I want wind to push my projectile by a strength and direction shown on the HUD, so that I can compensate.
22. As a player, I want a small inherent shot variance, so that shots feel grounded rather than robotic, without being random.
23. As a player, I want the camera to follow my projectile cinematically and keep the impact visible, so that I can see the result.
24. As a player, I want impacts to deal maximum damage at the centre and less further out, to zero beyond the blast radius, so that near-misses still matter.
25. As a player, I want a direct or very close hit to be able to defeat a full-health tank in about two strong hits, so that matches stay short.
26. As a player, I want impacts to carve visible craters that persist for the whole match, so that the battlefield records the fight.
27. As a player, I want craters to never heal, fade, or be capped, so that repeated hits visibly scar the planet.
28. As a player, I want the ground directly under a tank to never be carved away, so that tanks are never left floating and can only be killed by blast damage.
29. As a player, I want shots that land in water to splash instead of cratering the seabed, so that lakes read as cover rather than diggable terrain.
30. As a player, I want to still deal blast damage to a shoreline tank when I land just short in shallow water, so that water isn't a damage-immunity exploit.
31. As a player, I want input locked while a shot is in flight and resolving, so that I don't accidentally interfere with the sequence.
32. As a player, I want to keep orbiting the camera while the AI is thinking, so that I can survey the board between turns.
33. As a player, I want to take the first turn of a match, so that the opening is mine.
34. As a player, I want to face three AI difficulty levels, so that I can pick a fair challenge.
35. As a player facing Easy AI, I want it to miss visibly and sometimes overcorrect, so that beginners can win.
36. As a player facing Medium AI, I want it to walk its shots toward me over several turns, so that it feels like a competent opponent.
37. As a player facing Hard AI, I want it to compensate well for wind and gravity and learn quickly, but never cheat with hidden information, so that losing feels fair.
38. As a player, I want the AI to be subject to the same shot variance I am, so that it isn't unnaturally perfect.
39. As a player, I want a minimal HUD showing both tanks' health, wind, the current turn, and the power meter, so that I have what I need without clutter.
40. As a player, I want a concise damage readout after an impact, so that I understand the effect of a hit.
41. As a player, I want turret bearing and elevation shown as compact numbers, so that I can aim precisely if I want to.
42. As a player, I want simple sounds for firing, flight, impact, explosion, and destruction, so that actions have feedback.
43. As a player, I want a match-ending hit to trigger an enhanced destruction sequence — large explosion, fire, smoke, debris, a subtle camera shake, and a brief linger — so that winning feels climactic.
44. As a player, I want a clean winner overlay at the end, so that the outcome is clear.
45. As a player, I want a "New Match" action at the end that generates a fresh planet, so that I can immediately play again.
46. As a player, I want the game to run smoothly on a reasonable modern desktop Chromium browser, so that the experience stays fluid.
47. As a player, I want a pause/settings affordance, so that I can step away or adjust.
48. As a developer, I want a toggleable debug panel overlaid in a corner, organised into collapsible sections, so that I can inspect and tune the game.
49. As a developer, I want to edit tunable values live and see them classified as live / next-shot / regenerate / new-match, so that I understand when each change takes effect.
50. As a developer, I want to trigger a planet regeneration when a change requires it, so that I can iterate on generation.
51. As a developer, I want to view and enter an internal seed in the debug panel, so that I can reproduce a specific planet while debugging generation.
52. As a developer, I want performance metrics (FPS, frame time, generation time, AI solve time, crater update time) surfaced, so that I can find hotspots.
53. As a developer, I want the trajectory guide, the live shot, and the AI to all use one shared simulation, so that they can never disagree.
54. As a developer, I want deterministic, seeded generation, so that a logged seed reproduces a planet for bug reports.
55. As a developer, I want the game rules and simulation to run headless (no Three.js), so that I can unit-test them.

## Implementation Decisions

The decomposition, seams, and interfaces below come from
`docs/design/mvp-module-decomposition.md` and rest on ADR-0001 … ADR-0006.
Domain terms are defined in `CONTEXT.md`. Stack per `TECHNICAL_DESIGN.md`:
TypeScript, React + React Three Fiber (Three.js, WebGL), Vite, a small state
store, Web Workers, Vitest, Playwright. No rigid-body engine in MVP.

**Eight core modules** (each a deep module with a small interface hiding
substantial implementation):

- **ShotSimulator** (in-process) — the one shared ballistic function:
  `simulate(input, environment, options) → ShotSimulationResult` (sampled
  trajectory + impact + escaped flag). Options select sample window, variance
  on/off, and stop-on-first-collision. Consumed by the live shot, trajectory
  guide, AI solver, tests, and debug. Behind the seam: radial gravity, wind,
  fixed-step integration, seeded variance, and swept terrain/tank/water
  collision. **Design chosen by design-it-twice (ADR-0005): one-shot predict,
  then play back** — the live projectile computes its entire arc at fire time and
  the renderer interpolates along it, so guide and live shot are the same
  computation. GravityField is a real internal seam (constant-radial now,
  inverse-square from a spike); WindField keeps an `accelerationAt(position,
  time)` shape but ships a single uniform implementation. Neither is exposed on
  `simulate`.
- **Terrain** (in-process) — one deep module owning the authoritative logical
  height field; the render mesh is a projection of it. Two segregated interface
  faces: a **read-only `TerrainQuery` view** (`surfaceRadius`, `surfacePoint`,
  `signedDistance`, `normalAt`) handed to the simulator and AI, and
  **`applyCrater(impact, config) → TerrainChangeSet`** used only inside
  GameSession's impact ordering. The tank-footprint guard (ADR-0001) and
  water-surface clamp (ADR-0004) live *inside* `applyCrater`; footprints are
  registered at match start so the guard can't be bypassed. The change-set names
  only the affected region so the renderer does a local GPU-buffer update.
- **PlanetGenerator** (ports & adapters) — `generate(config, onProgress) →
  Planet` behind a transport port with two adapters: a Web Worker adapter for
  production and a synchronous adapter for tests. Runs the staged pipeline
  (preset → radius → base terrain → hills → mountains → canyons → water → snow →
  rocks → clouds → render data → query/collision data → spawn candidates → spawn
  selection → environment), using a seeded, forked RandomSource. The spawn
  **relax → reseed → fail-loud** escalation (ADR-0003) lives here: soft
  constraints (separation, then slope) degrade to floors, then the planet is
  discarded and regenerated from a new internal seed up to a cap, then a
  dev-facing failure; hard constraints (not underwater, minimum clearance) are
  inviolable.
- **ArtilleryAI** (in-process) — `chooseShot(context) → Promise<ShotCommand>` and
  `observe(result)`. Reuses ShotSimulator and the read-only TerrainQuery view;
  owns no physics. Coarse-to-fine search over bearing/elevation/power, miss
  scoring, prior-shot memory, and difficulty error/convergence, all as
  data-driven `DifficultyProfile` config (not separate classes). Fires through
  the normal shot-command path; never reads hidden outcomes.
- **GameSession** (in-process) — the turn/phase state machine. Phases:
  `LOADING, OPENING_FLYOVER, PLAYER_AIM, PLAYER_CHARGING,
  PLAYER_PROJECTILE_FLIGHT, PLAYER_IMPACT_RESOLUTION, AI_THINKING,
  AI_PROJECTILE_FLIGHT, AI_IMPACT_RESOLUTION, MATCH_END_CINEMATIC, RESULTS,
  PAUSED`. Owns turn order (player first), input-lock lifecycle, win evaluation,
  and the **fixed impact ordering** (detect impact → stop sim → blast damage
  computed against the *pre-deform* surface → apply damage → deform terrain →
  update query/collision → update render buffers → VFX/audio → evaluate
  destruction → end cinematic or next turn). **Communicates with presentation
  only through a small typed dispatcher, bidirectionally (ADR-0006):** domain
  events out (`TurnStarted`, `ShotFired` carrying the precomputed trajectory,
  `ProjectileImpacted`, `TankDamaged`, `TankDestroyed`, `MatchEnded`),
  presentation completion triggers in (`PlaybackFinished`,
  `DestructionSequenceFinished`). Imports no presentation module.
- **CameraDirector** (in-process) — `transitionTo(mode, context)` and
  `shake(config)`, driven by GameSession events. Modes: `openingFlyover,
  playerOrbit, projectileFollow, impact, destruction, results`. Splits the pure
  **policy** (which mode a phase selects) from the **motion** (poses, damping);
  `projectileFollow` interpolates along the precomputed trajectory (ADR-0005).
- **RandomSource** (in-process) — `next/range/int/pick/fork`; hides the PRNG,
  forked streams give seed stability. Seeds are development-only (ADR-0002): no
  player-facing seed entry, sharing, or same-seed replay; the only end-of-match
  action is New Match.
- **TuningRegistry** (in-process) — typed `TuningParameter<T>` carrying an
  update-mode (`live | nextShot | regenerate | newMatch`); the debug UI renders
  controls from it; respects hard safety limits.

**Configuration hierarchy** (ARCHITECTURE): hard safety limits → application
defaults → planet preset → match config → debug overrides. Debug overrides
respect safety limits.

## Testing Decisions

Good tests here assert **observable behaviour through a module's interface**, not
internal state, and survive internal refactors. The design deliberately makes the
deterministic core testable without mounting a Three.js scene. Tests for the
**deterministic core** modules:

- **ShotSimulator** — known ballistic fixtures produce expected trajectories;
  gravity acceleration points to the planet centre; identical input → identical
  trajectory (determinism); the guide, live shot, and AI produce identical arcs
  from identical input; variance stays within bounds and is reproducible per shot
  input.
- **Terrain** — a crater lowers height and never raises it; nothing deforms
  inside a registered footprint; a query immediately after `applyCrater` reflects
  the new surface; water impacts leave the seabed untouched; the change-set names
  only the affected region.
- **PlanetGenerator** — same seed → same planet (via the synchronous adapter);
  selected spawns satisfy minimum separation or the documented relaxation order;
  progress is monotonic; unsatisfiable constraints trigger reseed and then a loud
  dev-facing failure; hard constraints are never violated.
- **ArtilleryAI** — Hard converges within a bounded number of shots on fixtures;
  Easy misses more and can overcorrect; memory shifts the next aim after a miss;
  the AI is subject to shared variance; the AI never accesses hidden outcomes.
- **GameSession** — only legal phase transitions occur; a completed turn never
  leaves two live projectiles; input is locked during flight and impact; damage
  resolves against the pre-deform surface (before deformation); a tank at zero
  health ends the match; the emitted event sequence matches the turn flow (driven
  headless with completion triggers, no camera/clock).
- **RandomSource** — determinism and fork independence (a change to one forked
  stream doesn't shift another).

Property/invariant tests (ARCHITECTURE §testing): gravity points to centre;
health never exceeds max; damage never negative; damage zero outside blast
radius; spawns satisfy separation; terrain removal never raises height; a turn
never leaves two active projectiles.

**Not unit-tested:** CameraDirector *motion* and other rendering (verified
manually and with a small Playwright smoke suite once the loop exists — app
loads, match generates, aim, charge/release fires, projectile resolves, AI turn
begins, debug panel toggles); TuningRegistry beyond update-mode routing and
safety-limit clamping. No broad screenshot/visual-regression coverage early; no
global coverage thresholds during the prototype.

Prior art: none yet — greenfield. Vitest for deterministic logic, Playwright for
the smoke suite, per `TECHNICAL_DESIGN.md`.

## Out of Scope

Everything in `BACKLOG.md`, and specifically: networked PvP, accounts, backend,
persistence, progression, campaigns, weapon inventory/selection, tank movement,
recorded/replay viewers, analytics, mobile/touch/gamepad, Safari/Firefox
hardening. Player-facing seeds (entry, sharing, same-seed replay) are out
(ADR-0002). Altitude/atmosphere wind, mid-shot wind variation, inverse-square
gravity (unless selected during the spike), voxel/SDF terrain, terrain addition,
water physics, dynamic terrain collapse, physical rigid-body debris, tank
suspension/track/chassis conformance are out. Mid-flight terrain change and
multiple simultaneous projectiles are explicitly closed off by ADR-0005.

Deferred to technical spikes (not decided in this PRD): final gravity model
(constant-radial vs inverse-square), integrator choice (semi-implicit Euler vs
RK4), the terrain collision-acceleration structure, and icosphere subdivision
level. Deferred to tuning/art: exact art-direction references, default gravity
scale per preset, and exact planet radius range.

## Further Notes

- The whole game is a static client-side build (HTML shell + hashed JS/CSS + 3D,
  texture, and audio assets); no runtime API, database, or auth. CI gates:
  typecheck, lint, unit tests, production build; add the Chromium smoke suite once
  the first playable loop exists.
- Numeric defaults in `docs/` (400 HP, 200 max damage, ~5% variance, 25% guide,
  45% guide opacity, etc.) are initial values, tunable via TuningRegistry, not
  hard constraints — except the explicit fixed rules (no crater cap, no crater
  fade, terrain removal only, symmetry not required).
- Suggested build order follows the technical spikes: spherical terrain quality →
  projectile integration → terrain collision → crater update → AI solver, then the
  vertical loop.
- This is the canonical requirements source. Behavioural questions once left
  open are resolved via ADR-0001 … ADR-0006, `CONTEXT.md`, and the design doc;
  `docs/` holds the technical design, architecture, tuning guide, and backlog.
