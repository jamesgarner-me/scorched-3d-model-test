# Planetary Artillery

Client-only turn-based 3D artillery duel on a procedurally generated planet.

## Run

```bash
npm install
npm run dev
```

Production build (static `dist/`, Vercel-ready from this folder):

```bash
npm run build
```

## Play

1. Pick Earth-like or Mars-like, then an AI difficulty.
2. Wait for the survey to raise a fresh world.
3. Orbit with the mouse. Aim with arrow keys. Hold Space to charge, release to fire.
4. The first quarter of the arc is a guide — the landing point is not.
5. After your shot resolves, the AI fires with the same physics.
6. Last tank standing wins. **New match** raises another planet.
