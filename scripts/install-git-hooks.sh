#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$REPO_ROOT"

git config core.hooksPath .githooks

echo "Configured Git hooks for this repository."
echo "Verify with: git config --get core.hooksPath"
