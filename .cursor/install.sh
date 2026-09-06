#!/usr/bin/env bash
# Idempotent dependency refresh for every app in the repository.
# Each folder is an independent npm project with its own committed lockfile,
# so `npm ci` is the deterministic path that works on any npm version
# (plain `npm install` fails on npm 10 for the landing app's peer graph).
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

apps=(
  "landing"
  "models/astra"
  "models/fable-5.1"
  "models/grok-4.6"
  "models/opus-5"
)

for app in "${apps[@]}"; do
  dir="$repo_root/$app"
  if [ -f "$dir/package-lock.json" ]; then
    echo "==> npm ci ($app)"
    (cd "$dir" && npm ci)
  else
    echo "==> skipping $app (no package-lock.json yet)"
  fi
done

echo "==> install complete"
