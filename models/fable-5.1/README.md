# Planetary Artillery — Fable 5.1 one-shot

Frozen first-shot snapshot from Fable 5.1, generated from `docs/prompt.md` and
`docs/PRD.md`. Do not iterate the result after this first generation.

A client-only, turn-based 3D artillery duel on a procedurally generated
spherical planet: you versus an AI tank. Aim with the arrow keys, hold Space to
charge power, release to fire. Shots bend under planet-centred gravity and
wind, deal blast damage, and carve persistent craters.

## Run

```
npm install
npm run dev      # http://localhost:5173
npm run build    # static site in dist/ (Vercel: use this folder as the root)
```

Add `?debug` to the URL (or run the dev server) and press `` ` `` to open the
tuning / metrics panel.

## Controls

| Key | Action |
| --- | --- |
| ← → | Turret bearing |
| ↑ ↓ | Cannon elevation |
| Space (hold / release) | Charge power / fire |
| Mouse drag / wheel / right-drag | Orbit / zoom / pan the camera |
| Esc | Pause and settings |
| Any key | Skip the flyover |
| ` | Debug panel (dev or `?debug`) |

## Layout

```
src/sim      headless rules and simulation (no Three.js): planet generation,
             shared ballistic sim, damage, craters, AI, match state, tuning
src/state    store + game-flow controller (phases, timers, turns)
src/render   React Three Fiber scene: terrain, water, clouds, atmosphere,
             tanks, projectile, trajectory guide, effects, camera director
src/ui       menu, loading, HUD, overlays, debug panel
src/audio    procedural Web Audio sound effects
```

The trajectory guide, the live shot and the AI all call the same
`simulateShot` function, so they can never disagree. Generation is seeded and
deterministic: the seed shown on the flyover banner reproduces a planet.
