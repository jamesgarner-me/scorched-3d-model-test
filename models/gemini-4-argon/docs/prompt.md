# One-shot: Planetary Artillery

Build a complete, playable browser game from the attached PRD (`docs/PRD.md`).

You are implementing **Planetary Artillery** (Scorched 3D): a client-only,
turn-based 3D artillery duel on a procedurally generated spherical planet. One
human tank vs one AI tank. The planet is the puzzle — curvature, gravity, wind,
and terrain. Aim with bearing and elevation, hold Space to charge power, release
to fire. Shots follow a ballistic arc bent by planet-centred gravity and wind.
Impacts deal blast damage and carve persistent craters.

## What to produce

A self-contained Vite + React + TypeScript + React Three Fiber app in this
folder. `npm install && npm run dev` must start the game. `npm run build` must
produce a static `dist/` that can be hosted on Vercel with this folder as the
project root. No backend, no accounts, no monorepo tooling, no extra packages
beyond what the game needs.

## How to use the PRD

The PRD is the requirements source. Implement the player-facing loop and the
user stories.

## Must-have loop

1. A loading screen while a fresh planet generates.
2. Earth-like and Mars-like presets that look and play differently.
3. Player aims with arrow keys and fires by holding Space.
4. A trajectory guide that shows about the first quarter of the arc, never the
   landing point.
5. Gravity toward the planet centre, and wind shown on the HUD.
6. Persistent craters. Do not carve under a tank or through water (splash
   instead).
7. An AI opponent that uses the same physics and takes a turn after you.
8. Match ends at zero health, with a winner overlay and New Match.

## Out of scope

No networked PvP, accounts, persistence, tank movement, extra weapons, or
mobile / touch controls. Do not invent features that are not in the PRD.

## Done when

A stranger can open the app in Chromium, play a full match against the AI, and
start a new one — without reading the code.
