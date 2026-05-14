#!/usr/bin/env bash
set -euo pipefail

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
readonly INSTALL_ROOT="${JOERN_INSTALL_ROOT:-$REPO_ROOT/build/callchain/joern}"
readonly INSTALLER="$INSTALL_ROOT/joern-install.sh"
readonly INSTALLER_URL="https://github.com/joernio/joern/releases/latest/download/joern-install.sh"

usage() {
    cat <<'EOF'
Usage:
  tools/callchain/setup-joern.sh

Installs a build-local Joern CLI for ad-hoc callchain diagrams.

Environment:
  JOERN_INSTALL_ROOT  Override the install root. Defaults to build/callchain/joern.

Notes:
  - This script downloads Joern's official installer from GitHub.
  - The installation stays under build/callchain/ by default.
  - Graph rendering still requires Graphviz's dot command on PATH.
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
    usage
    exit 0
fi

mkdir -p "$INSTALL_ROOT"

if [[ -x "$INSTALL_ROOT/joern/joern-cli/joern" ]]; then
    printf 'Joern already installed at %s\n' "$INSTALL_ROOT/joern/joern-cli"
else
    printf 'Downloading Joern installer to %s\n' "$INSTALLER"
    curl -L "$INSTALLER_URL" -o "$INSTALLER"
    chmod u+x "$INSTALLER"
    printf 'Running Joern installer under %s\n' "$INSTALL_ROOT"
    (
        cd "$INSTALL_ROOT"
        "$INSTALLER" --interactive=false
    )
fi

if ! command -v dot >/dev/null 2>&1; then
    cat >&2 <<'EOF'
Warning: Graphviz dot is not on PATH.
Install Graphviz before rendering SVG diagrams.
EOF
fi

printf 'Use JOERN_HOME=%s/joern/joern-cli or add that directory to PATH.\n' "$INSTALL_ROOT"
