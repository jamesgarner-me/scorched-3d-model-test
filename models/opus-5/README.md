# Planetary Artillery

A turn-based 3D artillery duel on a procedurally generated planet. One human tank
against one AI tank. Entirely client-side — no backend, no accounts, no install.

```bash
npm install
npm run dev      # http://localhost:5173
```

```bash
npm run build    # static output in dist/
npm run preview  # serve the production build
npm test         # headless rules + simulation tests
```

Deploys to Vercel as a static site with this folder as the project root; no
configuration or environment variables are needed.

## Playing

You take the first turn.

| Input | Action |
| --- | --- |
| `←` `→` | Turret bearing (hold for continuous adjustment) |
| `↑` `↓` | Cannon elevation |
| `Space` | Hold to charge power, release to fire |
| Drag | Orbit the camera |
| Shift-drag / right-drag | Pan |
| Scroll | Zoom |
| `Esc` | Pause |
| `M` | Mute |
| `` ` `` | Debug panel (development builds only) |

The trajectory guide shows roughly the first quarter of the arc and never the
landing point — you have to read the rest of the world yourself. Before you start
charging it previews your *last* shot's power, so you can range in from a known
baseline.

Two things bend every shell: gravity, which always points at the planet's centre
rather than "down", and wind, whose bearing and strength are on the HUD compass
(the blue marker is your turret, the amber arrow is the wind).

Impacts deal blast damage that falls to zero at the edge of the blast radius, and
carve craters that persist for the whole match. Craters never heal, fade, or stop
accumulating — but the ground directly under a tank is never removed, so a tank can
only be killed by blast damage, and shells that land in water splash instead of
dredging the seabed.

## Worlds

**Terra** — oceans, forests, snow on high ground, gusty air, heavier gravity and
flatter, faster arcs.

**Ares** — dry rust and dust, no water, low gravity and long floating shots that
take noticeably more lead.

Planet radius is rolled fresh every match, so curvature and shot range change the
tactical problem each time. A seed can be typed on the menu (or in the debug panel)
to reproduce a specific world exactly.

## Opponents

**Recruit** misses visibly and sometimes overcorrects past you. **Gunner** walks its
shots onto you over a few turns. **Marshal** reads wind and gravity quickly.

The AI runs the same simulation your trajectory guide draws from, aims from the same
barrel, and is subject to the same shot variance you are. It uses only what a player
can see — both tanks' positions, the terrain, the wind on the HUD. Difficulty is a
standing aim error that decays after each shot, which is why its shells visibly walk
in rather than snapping onto target.

## How it is put together

```
src/game/     Headless rules and simulation. No Three.js, no React — this is what
              the tests exercise.
  vec.ts        Vectors, surface frames, bearing/elevation maths
  rng.ts        Seeded PRNG; a logged seed reproduces a planet exactly
  noise.ts      Seeded Perlin noise, fBm and ridged stacks
  cubesphere.ts Tangent-warped cube sphere; direction → (face, u, v) is exact
  planet.ts     Spherical heightfield, generation, crater carving
  physics.ts    The ballistic integrator
  damage.ts     Blast falloff
  ai.ts         Aim solver and difficulty model
  match.ts      Turn order, firing, damage resolution, tank placement
  tuning.ts     Every tunable number, with when-it-applies metadata
src/render/   Three.js / React Three Fiber scene
src/ui/       HUD, menus, overlays, debug panel, keyboard input
src/state/    The phase machine that drives the match loop
```

Two decisions shape most of the rest:

**One simulation.** `simulateShot` is the only integrator. The trajectory guide, the
shell you watch, and every candidate the AI evaluates all call it, so they cannot
disagree. A shot is integrated in full at launch and then *replayed* — what you watch
is exactly what was resolved.

**Terrain as six grids.** The planet is a tangent-warped cube sphere: six square
heightfields whose direction→cell mapping is an exact inverse, so a height lookup
during physics is a bilinear fetch rather than a search. Heights match exactly along
shared edges, so the seams are invisible. Carving a crater sweeps the grids and marks
only the faces it touched for re-upload.

## Tuning

Press `` ` `` in a development build for a panel with live perf counters (FPS, frame
time, generation, AI solve, crater carve, terrain upload) and every tunable value,
each labelled with when a change takes effect — **live**, **next-shot**,
**regenerate**, or **new-match**. The seed field plus *Regenerate* reproduces any
world for debugging.
