#!/usr/bin/env bash
# game-ui-refiner full lint pipeline.
#
# Runs all static checks in sequence and exits non-zero on the first failure.
# Run from repo root: `bash tools/lint.sh` or `npm run lint`.

set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> [1/4] TypeScript type-check (tsc --noEmit)"
npx tsc --noEmit

echo
echo "==> [2/4] Static analyzer (tools/check.mjs)"
node tools/check.mjs

echo
echo "==> [3/4] Parser unit tests (tests/run.mjs)"
node tests/run.mjs

echo
echo "==> [4/4] Python lint (ruff check serve.py)"
if command -v ruff >/dev/null 2>&1; then
  ruff check serve.py
else
  echo "  (ruff not installed, skipping — install with: pip install ruff)"
fi

echo
echo "✓ all checks passed"
