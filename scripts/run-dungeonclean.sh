#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$REPO_ROOT"

./gradlew --console=plain installDist

APP_LIB_DIR="$REPO_ROOT/build/install/salt-marcher/lib"

exec java \
  --enable-preview \
  --source 21 \
  --module-path "$APP_LIB_DIR" \
  --add-modules javafx.controls \
  -cp "$APP_LIB_DIR/*" \
  "$SCRIPT_DIR/DungeoncleanLauncher.java" \
  "$@"
