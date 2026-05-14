#!/usr/bin/env bash
set -euo pipefail

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

usage() {
    cat <<'EOF'
Usage:
  tools/gradle/run-staged-verification.sh [--fail-fast] <surface> [-- <extra-gradle-args>]

Supported entrypoints:
  production-handoff
  desktop-install

Options:
  --fail-fast  Do not add wrapper-owned Gradle --continue.

Extra Gradle args are forwarded for additional investigation flags such as
--rerun-tasks or --stacktrace. Wrapper-owned runtime flags such as `--console`
and `--project-dir` remain owned by the underlying runtime wrapper and are
ignored if passed here.
EOF
}

is_supported_surface() {
    case "$1" in
      production-handoff|desktop-install)
        return 0
        ;;
      *)
        return 1
        ;;
    esac
}

declare -a requested_surfaces=()
declare -a extra_args=()
fail_fast=false
while [[ $# -gt 0 ]]; do
    if [[ "$1" == "--" ]]; then
        shift
        extra_args=("$@")
        break
    fi
    if [[ "$1" == "--fail-fast" ]]; then
        fail_fast=true
        shift
        continue
    fi
    requested_surfaces+=("$1")
    shift
done

if [[ ${#requested_surfaces[@]} -eq 0 ]]; then
    usage >&2
    exit 64
fi

if [[ ${#requested_surfaces[@]} -gt 1 ]]; then
    echo "[staged-verification] Expected exactly one entrypoint, got ${#requested_surfaces[@]}" >&2
    usage >&2
    exit 64
fi

if ! is_supported_surface "${requested_surfaces[0]}"; then
    echo "[staged-verification] Unsupported entrypoint: ${requested_surfaces[0]}" >&2
    usage >&2
    exit 64
fi

run_surface() {
    local surface="$1"

    echo "[staged-verification] Surface: $surface"
    echo

    (
        cd "$REPO_ROOT"
        if [[ ${#extra_args[@]} -gt 0 ]]; then
            if [[ "$fail_fast" == true ]]; then
                "$REPO_ROOT/tools/gradle/run-observable-gradle.sh" --fail-fast "$surface" -- "${extra_args[@]}"
            else
                "$REPO_ROOT/tools/gradle/run-observable-gradle.sh" "$surface" -- "${extra_args[@]}"
            fi
        elif [[ "$fail_fast" == true ]]; then
            "$REPO_ROOT/tools/gradle/run-observable-gradle.sh" --fail-fast "$surface"
        else
            "$REPO_ROOT/tools/gradle/run-observable-gradle.sh" "$surface"
        fi
    )
}

for surface in "${requested_surfaces[@]}"; do
    run_surface "$surface"
done
