#!/usr/bin/env bash
set -euo pipefail

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
readonly BUILD_ROOT="$REPO_ROOT/build/callchain"
readonly CPG_FILE="${CALLCHAIN_CPG_FILE:-$BUILD_ROOT/saltmarcher-cpg.bin.zip}"
readonly DEFAULT_DEPTH=8

usage() {
    cat <<'EOF'
Usage:
  tools/callchain/render-callchain.sh [options] <method-selector>

Options:
  --depth <n>          Transitive call depth. Default: 8.
  --include-external  Include non-SaltMarcher methods.
  --refresh           Rebuild the Joern CPG before rendering.
  --out <dir>         Override output directory.

Selectors:
  Fully qualified method name, Joern fullName fragment, or Type#method.

Examples:
  tools/callchain/render-callchain.sh src.domain.travel.TravelApplicationService#applyDungeonTravelSession
  tools/callchain/render-callchain.sh --depth 4 DungeonTravelIntentHandler#consume

Output:
  build/callchain/out/<selector>/callchain.txt
  build/callchain/out/<selector>/callers.txt
  build/callchain/out/<selector>/callees.txt
  DOT files are written beside the text files for optional external rendering.
EOF
}

sanitize_segment() {
    printf '%s' "$1" |
        LC_ALL=C tr -cs 'A-Za-z0-9._#-' '-' |
        sed 's/^-*//; s/-*$//' |
        cut -c1-120
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
    local build_local="$BUILD_ROOT/joern/joern-cli/$name"
    if [[ -x "$build_local" ]]; then
        printf '%s\n' "$build_local"
        return 0
    fi
    return 1
}

depth="$DEFAULT_DEPTH"
include_external=false
refresh=false
out_dir=""
selector=""

while (($# > 0)); do
    case "$1" in
      --depth)
        depth="${2:-}"
        shift 2
        ;;
      --include-external)
        include_external=true
        shift
        ;;
      --refresh)
        refresh=true
        shift
        ;;
      --out)
        out_dir="${2:-}"
        shift 2
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      -*)
        printf 'Unknown option: %s\n\n' "$1" >&2
        usage >&2
        exit 2
        ;;
      *)
        if [[ -n "$selector" ]]; then
            printf 'Only one method selector is supported.\n\n' >&2
            usage >&2
            exit 2
        fi
        selector="$1"
        shift
        ;;
    esac
done

if [[ -z "$selector" ]]; then
    usage >&2
    exit 2
fi

if ! [[ "$depth" =~ ^[0-9]+$ ]] || [[ "$depth" -lt 1 ]]; then
    printf 'Depth must be a positive integer, got: %s\n' "$depth" >&2
    exit 2
fi

if [[ "$refresh" == true || ! -f "$CPG_FILE" ]]; then
    "$SCRIPT_DIR/index.sh" --refresh
fi

joern="$(joern_bin joern)" || {
    cat >&2 <<'EOF'
joern not found.
Run tools/callchain/setup-joern.sh or set JOERN_HOME to a Joern CLI directory.
EOF
    exit 1
}

if [[ -z "$out_dir" ]]; then
    out_dir="$BUILD_ROOT/out/$(sanitize_segment "$selector")"
fi
mkdir -p "$out_dir"

(
    cd "$BUILD_ROOT"
    "$joern" --script "$SCRIPT_DIR/joern-callchain.sc" \
        --param "cpgFile=$CPG_FILE" \
        --param "selector=$selector" \
        --param "outDir=$out_dir" \
        --param "depth=$depth" \
        --param "includeExternal=$include_external"
)

printf 'Rendered callchain text under %s\n' "$out_dir"
