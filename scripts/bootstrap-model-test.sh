#!/usr/bin/env bash
#
# bootstrap-model-test.sh
#
# Sets up an isolated workspace for a one-shot model test and collects the
# result afterwards. It does NOT run the model: a human does that in between.
#
# Flow:
#   1. Create a temp dir OUTSIDE this repo containing only docs/PRD.md and
#      docs/prompt.md (plus a fresh git history), so the model cannot see other
#      models' implementations.
#   2. Wait while you open that dir in a new editor window, paste the prompt
#      and let the model build.
#   3. Copy the finished app into models/<name>/ in this repo.
#
# Usage:
#   ./scripts/bootstrap-model-test.sh <model-folder-name> [--verify] [--keep]
#
# Flags:
#   --verify  Run `npm ci` (or `npm install`) and `npm run build` in the temp dir before
#             copying back (warns on failure, never blocks).
#   --keep    Keep the temp dir after copying (default: ask).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

NAME=""
VERIFY=0
KEEP=0

for arg in "$@"; do
  case "${arg}" in
    --verify) VERIFY=1 ;;
    --keep) KEEP=1 ;;
    -h|--help)
      sed -n '2,24p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    -*)
      echo "Unknown flag: ${arg}" >&2
      exit 1
      ;;
    *) NAME="${arg}" ;;
  esac
done

if [[ -z "${NAME}" ]]; then
  read -r -p "Model folder name (e.g. gpt-6): " NAME
fi

if [[ ! "${NAME}" =~ ^[a-z0-9][a-z0-9.-]*$ ]]; then
  echo "Invalid name '${NAME}'. Use lowercase letters, digits, dots and hyphens." >&2
  exit 1
fi

DEST="${REPO_ROOT}/models/${NAME}"
if [[ -e "${DEST}" ]]; then
  echo "models/${NAME} already exists. Snapshots are frozen; refusing to overwrite." >&2
  exit 1
fi

for f in docs/PRD.md docs/prompt.md; do
  if [[ ! -f "${REPO_ROOT}/${f}" ]]; then
    echo "Missing ${f} in repo." >&2
    exit 1
  fi
done

# Temp dir lives outside the repo so `ls ..`, grep and git log cannot reach
# other models.
WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/scorched-${NAME}-XXXXXX")"

mkdir -p "${WORK_DIR}/docs"
cp "${REPO_ROOT}/docs/PRD.md" "${WORK_DIR}/docs/PRD.md"
cp "${REPO_ROOT}/docs/prompt.md" "${WORK_DIR}/docs/prompt.md"

(
  cd "${WORK_DIR}"
  git init -q
  git add -A
  git -c user.name="bootstrap" -c user.email="bootstrap@localhost" \
    commit -q -m "Baseline: PRD and prompt only"
)

cat <<EOF

Isolated workspace ready:
  ${WORK_DIR}

Next (manual):
  1. Open that folder in a NEW editor window. Do not open this repo, and do
     not add it as a workspace root, or the isolation is lost.
  2. Paste the contents of docs/prompt.md into the model and let it build.
     Do not iterate beyond the first generation.
  3. Come back here and press Enter.

(Ctrl-C to abort; the temp dir is kept.)

EOF

read -r -p "Press Enter when the model has finished... "

if [[ ! -f "${WORK_DIR}/package.json" ]]; then
  echo "No package.json in ${WORK_DIR}; nothing buildable was produced. Aborting (temp dir kept)." >&2
  exit 1
fi

if ! grep -q '"build"' "${WORK_DIR}/package.json"; then
  echo "Warning: package.json has no build script." >&2
fi

if [[ "${VERIFY}" -eq 1 ]]; then
  echo "Verifying build..."
  if (cd "${WORK_DIR}" && { npm ci || npm install; } && npm run build); then
    echo "Build OK."
  else
    echo "Warning: install/build failed. Copying anyway." >&2
  fi
fi

mkdir -p "${DEST}"
rsync -a \
  --exclude node_modules \
  --exclude dist \
  --exclude .git \
  --exclude .cursor \
  --exclude .claude \
  --exclude .DS_Store \
  --exclude '.env*' \
  --exclude '.vercel' \
  "${WORK_DIR}/" "${DEST}/"

echo
echo "Copied to models/${NAME}"
(cd "${REPO_ROOT}" && git status --short "models/${NAME}" | head -20)

if [[ "${KEEP}" -eq 0 ]]; then
  read -r -p "Delete temp dir ${WORK_DIR}? [y/N] " ANSWER
  if [[ "${ANSWER}" =~ ^[Yy]$ ]]; then
    rm -rf "${WORK_DIR}"
    echo "Deleted."
  else
    echo "Kept: ${WORK_DIR}"
  fi
else
  echo "Kept: ${WORK_DIR}"
fi

cat <<EOF

Remaining manual steps:
  - Create a Vercel project with Root Directory models/${NAME}
  - Add it to landing/src/data/models.json
  - Update the README layout and deployment tables
  - Commit and push
EOF
