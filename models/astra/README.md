# Planetary Artillery

A client-only 3D artillery duel built with React, TypeScript, Three.js and React Three Fiber.

```sh
npm install
npm run dev
```

Arrow keys adjust bearing and elevation. Hold Space to charge, release to fire. Drag to orbit, right-drag to pan, and scroll to zoom. Escape opens settings, including Earth/Mars presets and three AI difficulties. Preset selection applies when starting a new match.

```sh
npm test
npm run build
```

Deploy `dist/` as a static site. In Vercel, select this directory as the project root and the Vite preset. All assets, including fonts, are local; no runtime services are required.

In development, the Debug button or backtick opens seed regeneration, physics tuning, and performance metrics. The shared headless simulation lives in `src/simulation.ts`.
