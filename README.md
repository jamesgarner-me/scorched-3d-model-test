# scorched-3d-model-test

One-shot prompt Scorched 3D game of various models.

This repo compares first-shot implementations of the same planetary artillery
game. The shared specification lives in `docs/`. Each model folder is a frozen
snapshot of what that model produced from `docs/prompt.md` and `docs/PRD.md`.
Do not keep iterating a folder after the first generation if the point is to
compare first-shot quality.

There is no shared workspace, no root `package.json`, and no shared
`node_modules`. Each model folder becomes its own app only after that model
generates it.

## Layout

```
docs/PRD.md      Product requirements (copied from the original Scorched 3D PRD)
docs/prompt.md   Prompt to paste into each model (fill this in before a run)
opus/            Claude Opus one-shot
fable/           Fable one-shot
astra/           Astra one-shot
```

## Deployment

Each model folder will be its own Vercel project, with that folder as the Root
Directory. Projects are not created until a folder contains a buildable app.
