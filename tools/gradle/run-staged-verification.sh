#!/usr/bin/env bash
set -euo pipefail

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

usage() {
    cat <<'EOF'
Usage:
  tools/gradle/run-staged-verification.sh <surface> [<surface> ...] [-- <extra-gradle-args>]

Verification surfaces:
  production-build
  quality-hygiene
  architecture
  view-topology
  docs
  metrics-report
  desktop-install
  production-handoff

Extra Gradle args are forwarded for additional investigation flags such as
--rerun-tasks or --stacktrace. Wrapper-owned runtime flags such as `--console`
and `--project-dir` remain owned by the underlying runtime wrapper and are
ignored if passed here.
EOF
}

declare -a requested_surfaces=()
declare -a extra_args=()
while [[ $# -gt 0 ]]; do
    if [[ "$1" == "--" ]]; then
        shift
        extra_args=("$@")
        break
    fi
    requested_surfaces+=("$1")
    shift
done

if [[ ${#requested_surfaces[@]} -eq 0 ]]; then
    usage >&2
    exit 64
fi

run_surface() {
    local surface="$1"

    echo "[staged-verification] Surface: $surface"
    echo

    (
        cd "$REPO_ROOT"
        export SALTMARCHER_GRADLE_STAGE="$surface"
        if [[ ${#extra_args[@]} -gt 0 ]]; then
            "$REPO_ROOT/tools/gradle/run-observable-gradle.sh" "$surface" -- "${extra_args[@]}"
        else
            "$REPO_ROOT/tools/gradle/run-observable-gradle.sh" "$surface"
        fi
    )
}

for surface in "${requested_surfaces[@]}"; do
    run_surface "$surface"
done
