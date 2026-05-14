#!/usr/bin/env bash
set -euo pipefail

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
readonly BUILD_ROOT="$REPO_ROOT/build/callchain"
readonly SOURCE_ROOT="$BUILD_ROOT/source"
readonly CPG_FILE="${CALLCHAIN_CPG_FILE:-$BUILD_ROOT/saltmarcher-cpg.bin.zip}"

usage() {
    cat <<'EOF'
Usage:
  tools/callchain/index.sh [--refresh]

Builds or reuses the Joern CPG used by render-callchain.sh.

Environment:
  JOERN_HOME           Directory containing joern and joern-parse.
  CALLCHAIN_CPG_FILE  Override the CPG output path.

Examples:
  tools/callchain/setup-joern.sh
  JOERN_HOME=build/callchain/joern/joern/joern-cli tools/callchain/index.sh --refresh
EOF
}

joern_bin() {
    local name="$1"
    if [[ -n "${JOERN_HOME:-}" && -x "$JOERN_HOME/$name" ]]; then
        printf '%s/%s\n' "$JOERN_HOME" "$name"
        return 0
    fi
    if command -v "$name" >/dev/null 2>&1; then
        command -v "$name"
        return 0
    fi
    local build_local="$BUILD_ROOT/joern/joern/joern-cli/$name"
    if [[ -x "$build_local" ]]; then
        printf '%s\n' "$build_local"
        return 0
    fi
    return 1
}

refresh=false
while (($# > 0)); do
    case "$1" in
      --refresh)
        refresh=true
        shift
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        printf 'Unknown argument: %s\n\n' "$1" >&2
        usage >&2
        exit 2
        ;;
    esac
done

if [[ -f "$CPG_FILE" && "$refresh" == false ]]; then
    printf 'Reusing existing CPG: %s\n' "$CPG_FILE"
    printf 'Pass --refresh after source changes.\n'
    exit 0
fi

joern_parse="$(joern_bin joern-parse)" || {
    cat >&2 <<'EOF'
joern-parse not found.
Run tools/callchain/setup-joern.sh or set JOERN_HOME to a Joern CLI directory.
EOF
    exit 1
}

rm -rf "$SOURCE_ROOT"
mkdir -p "$SOURCE_ROOT" "$(dirname "$CPG_FILE")"
cp -a "$REPO_ROOT/bootstrap" "$SOURCE_ROOT/bootstrap"
cp -a "$REPO_ROOT/shell" "$SOURCE_ROOT/shell"
cp -a "$REPO_ROOT/src" "$SOURCE_ROOT/src"

rm -f "$CPG_FILE"
printf 'Indexing SaltMarcher sources with Joern...\n'
"$joern_parse" "$SOURCE_ROOT" --output "$CPG_FILE" --enable-file-content
printf 'Wrote CPG: %s\n' "$CPG_FILE"
