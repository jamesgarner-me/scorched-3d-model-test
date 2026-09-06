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
docs/PRD.md         Product requirements (copied from the original Scorched 3D PRD)
docs/prompt.md      Prompt to paste into each model (fill this in before a run)
models/astra/       Astra one-shot
models/fable-5.1/   Fable 5.1 one-shot
models/grok-4.6/    Grok 4.6 one-shot
models/opus-5/      Opus 5 one-shot
landing/            Directory page linking out to every deployed one-shot
```

The bare `astra/`, `fable/` and `opus/` folders predate `models/` and hold
nothing but a placeholder README.

`landing/` is not part of the comparison, so it is the one folder here that can
be iterated freely.

## Deployment

Each model folder is its own Vercel project, with that folder as the Root
Directory. Projects are not created until a folder contains a buildable app.
Project names drop the dots from the folder name:

| Folder | Deployment |
| --- | --- |
| `models/astra` | https://scorched-3d-astra.vercel.app |
| `models/fable-5.1` | https://scorched-3d-fable-51.vercel.app |
| `models/grok-4.6` | https://scorched-3d-grok-46.vercel.app |
| `models/opus-5` | https://scorched-3d-opus-5.vercel.app |

`landing/` deploys the same way and lists all of the above. When a new model
folder is deployed, add it to `landing/src/data/models.json`.
