#!/usr/bin/env bash
set -euo pipefail

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

usage() {
    cat <<'EOF'
Usage:
  tools/gradle/run-staged-verification.sh [--fail-fast] <surface> [-- <extra-gradle-args>]
  tools/gradle/run-staged-verification.sh [--fail-fast] focused-handoff --path <repo-path> [--path <repo-path> ...] [--area <area> ...] [--with compile-integrity] [-- <extra-gradle-args>]

Supported entrypoints:
  production-handoff
  focused-handoff
  desktop-install

Focused handoff areas:
  view, styling, shell, bootstrap, layering, domain, data

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
      production-handoff|focused-handoff|desktop-install)
        return 0
        ;;
      *)
        return 1
        ;;
    esac
}

focused_area_task() {
    case "$1" in
      view) printf '%s\n' "checkViewEnforcement" ;;
      styling) printf '%s\n' "checkStylingEnforcement" ;;
      shell) printf '%s\n' "checkShellEnforcement" ;;
      bootstrap) printf '%s\n' "checkBootstrapEnforcement" ;;
      layering) printf '%s\n' "checkLayeringEnforcement" ;;
      domain) printf '%s\n' "checkDomainEnforcement" ;;
      data) printf '%s\n' "checkDataEnforcement" ;;
      *)
        return 1
        ;;
    esac
}

normalize_focused_path() {
    local path="$1"
    path="${path#./}"
    path="${path%/}"
    if [[ -z "$path" || "$path" == /* || "$path" == *".."* || "$path" == *"*"* || "$path" == *"?"* || "$path" == *"["* ]]; then
        return 1
    fi
    printf '%s\n' "$path"
}

infer_focused_area() {
    case "$1" in
      src/view|src/view/*) printf '%s\n' "view" ;;
      src/domain|src/domain/*) printf '%s\n' "domain" ;;
      src/data|src/data/*) printf '%s\n' "data" ;;
      shell|shell/*) printf '%s\n' "shell" ;;
      bootstrap|bootstrap/*) printf '%s\n' "bootstrap" ;;
      resources|resources/*) printf '%s\n' "styling" ;;
      *)
        return 1
        ;;
    esac
}

append_unique() {
    local candidate="$1"
    shift
    local existing
    for existing in "$@"; do
        if [[ "$existing" == "$candidate" ]]; then
            return 1
        fi
    done
    printf '%s\n' "$candidate"
}

join_by_comma() {
    local joined=""
    local item
    for item in "$@"; do
        if [[ -n "$joined" ]]; then
            joined="${joined},"
        fi
        joined="${joined}${item}"
    done
    printf '%s' "$joined"
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

if ! is_supported_surface "${requested_surfaces[0]}"; then
    echo "[staged-verification] Unsupported entrypoint: ${requested_surfaces[0]}" >&2
    usage >&2
    exit 64
fi

run_surface() {
    local surface="$1"

    echo "[staged-verification] Surface: $surface"
    echo

    if [[ "$surface" == "production-handoff" ]]; then
        run_observable_gradle "$fail_fast" production-handoff
        return
    fi

    if [[ "$surface" == "focused-handoff" ]]; then
        run_focused_handoff "${requested_surfaces[@]:1}"
        return
    fi

    run_observable_gradle "$fail_fast" "$surface"
}

run_observable_gradle() {
    local phase_fail_fast="$1"
    shift
    local task_names=("$@")

    (
        cd "$REPO_ROOT"
        if [[ ${#extra_args[@]} -gt 0 ]]; then
            if [[ "$phase_fail_fast" == true ]]; then
                "$REPO_ROOT/tools/gradle/run-observable-gradle.sh" --fail-fast "${task_names[@]}" -- "${extra_args[@]}"
            else
                "$REPO_ROOT/tools/gradle/run-observable-gradle.sh" "${task_names[@]}" -- "${extra_args[@]}"
            fi
        elif [[ "$phase_fail_fast" == true ]]; then
            "$REPO_ROOT/tools/gradle/run-observable-gradle.sh" --fail-fast "${task_names[@]}"
        else
            "$REPO_ROOT/tools/gradle/run-observable-gradle.sh" "${task_names[@]}"
        fi
    )
}

run_focused_handoff() {
    local args=("$@")
    local index=0
    local value normalized inferred area task
    local run_compile_integrity=false
    declare -a focused_paths=()
    declare -a explicit_areas=()
    declare -a selected_areas=()
    declare -a selected_tasks=()

    while [[ $index -lt ${#args[@]} ]]; do
        case "${args[$index]}" in
          --path)
            index=$((index + 1))
            if [[ $index -ge ${#args[@]} ]]; then
                echo "[staged-verification] --path requires a repo-relative path." >&2
                exit 64
            fi
            normalized="$(normalize_focused_path "${args[$index]}")" || {
                echo "[staged-verification] Invalid focused path: ${args[$index]}" >&2
                exit 64
            }
            if value="$(append_unique "$normalized" "${focused_paths[@]}")"; then
                focused_paths+=("$value")
            fi
            ;;
          --area)
            index=$((index + 1))
            if [[ $index -ge ${#args[@]} ]]; then
                echo "[staged-verification] --area requires an area name." >&2
                exit 64
            fi
            area="${args[$index]}"
            focused_area_task "$area" >/dev/null || {
                echo "[staged-verification] Unsupported focused area: $area" >&2
                exit 64
            }
            if value="$(append_unique "$area" "${explicit_areas[@]}")"; then
                explicit_areas+=("$value")
            fi
            ;;
          --with)
            index=$((index + 1))
            if [[ $index -ge ${#args[@]} ]]; then
                echo "[staged-verification] --with requires an option." >&2
                exit 64
            fi
            if [[ "${args[$index]}" != "compile-integrity" ]]; then
                echo "[staged-verification] Unsupported focused handoff option: --with ${args[$index]}" >&2
                exit 64
            fi
            run_compile_integrity=true
            ;;
          *)
            echo "[staged-verification] Unsupported focused handoff argument: ${args[$index]}" >&2
            exit 64
            ;;
        esac
        index=$((index + 1))
    done

    if [[ ${#focused_paths[@]} -eq 0 ]]; then
        echo "[staged-verification] focused-handoff requires at least one --path." >&2
        exit 64
    fi

    if [[ ${#explicit_areas[@]} -gt 0 ]]; then
        selected_areas=("${explicit_areas[@]}")
    else
        for normalized in "${focused_paths[@]}"; do
            inferred="$(infer_focused_area "$normalized")" || {
                echo "[staged-verification] Could not infer focused area for '$normalized'; pass --area explicitly." >&2
                exit 64
            }
            if value="$(append_unique "$inferred" "${selected_areas[@]}")"; then
                selected_areas+=("$value")
            fi
        done
    fi

    for area in "${selected_areas[@]}"; do
        task="$(focused_area_task "$area")"
        selected_tasks+=("$task")
    done

    echo "[staged-verification] Focused paths: $(join_by_comma "${focused_paths[@]}")"
    echo "[staged-verification] Focused areas: ${selected_areas[*]}"
    echo "[staged-verification] Focused tasks: ${selected_tasks[*]}"
    echo

    if [[ "$run_compile_integrity" == true ]]; then
        run_observable_gradle "$fail_fast" compileJava compileTestJava
    fi

    local focused_paths_property="-Dsaltmarcher.focusedVerificationPaths=$(join_by_comma "${focused_paths[@]}")"
    extra_args=("$focused_paths_property" "${extra_args[@]}")
    run_observable_gradle "$fail_fast" "${selected_tasks[@]}"
}

if [[ "${requested_surfaces[0]}" == "focused-handoff" ]]; then
    if ! is_supported_surface "${requested_surfaces[0]}"; then
        echo "[staged-verification] Unsupported entrypoint: ${requested_surfaces[0]}" >&2
        usage >&2
        exit 64
    fi
    run_surface "focused-handoff"
elif [[ ${#requested_surfaces[@]} -eq 1 ]]; then
    run_surface "${requested_surfaces[0]}"
else
    echo "[staged-verification] Expected exactly one entrypoint, got ${#requested_surfaces[@]}" >&2
    usage >&2
    exit 64
fi
