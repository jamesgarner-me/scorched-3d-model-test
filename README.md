# scorched-3d-model-test

One-shot prompt Scorched 3D game of various models.

This repo compares first-shot implementations of the same planetary artillery
game. The shared specification lives in `docs/`. Each model folder is a frozen
snapshot of what that model produced from `docs/prompt.md` and `docs/PRD.md`.
Do not keep iterating a folder after the first generation if the point is to
compare first-shot quality. To generate a new model folder without contaminating
the run, use the workflow in [Running a new model test](#running-a-new-model-test).

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
scripts/            Tooling for setting up and collecting model tests
```

`landing/` and `scripts/` are not part of the comparison, so they are the
folders here that can be iterated freely.

## Running a new model test

### Why

Coding agents explore their workspace: they glob, grep, read neighbouring
folders and can even run `git log` to see history. If a new model runs inside
this repo, it can see (and copy or be biased by) the other models' `models/*`
implementations, which ruins a first-shot comparison.

`scripts/bootstrap-model-test.sh` avoids this by creating a clean temp
directory outside the repo that contains only `docs/PRD.md` and
`docs/prompt.md`, with a fresh git history. The script does not run the model.
You do that by hand; the script only sets up beforehand and collects the result
afterwards.

### Instructions

1. Run `./scripts/bootstrap-model-test.sh <name>` (for example `gpt-6`). Use a
   lowercase name with digits, dots and hyphens. It refuses to overwrite an
   existing `models/<name>`.
2. Open the printed temp directory in a **new** editor window. Never open this
   repo, or add it as a workspace root, in that window.
3. Paste the contents of `docs/prompt.md` into the model and let it build. Do
   not iterate beyond the first generation.
4. Return to the terminal and press Enter. The script checks for a
   `package.json` and copies the app to `models/<name>/`, excluding
   `node_modules`, `dist`, `.git`, `.cursor`, `.claude`, `.vercel`, `.env*` and
   `.DS_Store`.
5. Create the Vercel project (see [Deployment](#deployment)), add the model to
   `landing/src/data/models.json` and the tables below, then commit and push.

Flags:

- `--verify`: run `npm ci` (or `npm install`) and `npm run build` in the temp directory
  before copying. Failures warn but do not block.
- `--keep`: keep the temp directory instead of asking whether to delete it.

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
