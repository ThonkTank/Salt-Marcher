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

normalize_focused_path() {
    local path="$1"
    path="${path#./}"
    path="${path%/}"
    if [[ -z "$path" || "$path" == /* || "$path" == *".."* || "$path" == *","* || "$path" == *"*"* || "$path" == *"?"* || "$path" == *"["* ]]; then
        return 1
    fi
    printf '%s\n' "$path"
}

normalize_focused_area() {
    local area="$1"
    area="${area#./}"
    area="${area%/}"
    if [[ -z "$area" || "$area" == *","* || "$area" == *"*"* || "$area" == *"?"* || "$area" == *"["* ]]; then
        return 1
    fi
    printf '%s\n' "$area"
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

contains_configuration_cache_flag() {
    local arg
    for arg in "$@"; do
        case "$arg" in
          --configuration-cache|--configuration-cache=*|--no-configuration-cache|--no-configuration-cache=*)
            return 0
            ;;
        esac
    done
    return 1
}

request_production_handoff_configuration_cache() {
    if contains_configuration_cache_flag "${extra_args[@]}"; then
        log_staged_line "[staged-verification] Configuration cache: caller-owned"
        return
    fi
    log_staged_line "[staged-verification] Configuration cache: requested by production-handoff default"
    extra_args=("--configuration-cache" "${extra_args[@]}")
}

run_project_health_debt_intake() {
    local label="$1"
    shift
    local intake_cmd=("$REPO_ROOT/tools/quality/reporting/project_health_scan.py" --intake --intake-only "$@")

    {
        echo "[staged-verification] Project health debt intake: $label"
        (
            cd "$REPO_ROOT"
            python3 "${intake_cmd[@]}"
        )
        echo
    } | tee -a "$STAGED_VERIFICATION_LOG"
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

readonly STAGED_VERIFICATION_LOG="$REPO_ROOT/build/gradle-run-logs/$(date -u '+%Y%m%dT%H%M%SZ')-staged-${requested_surfaces[0]}.log"
mkdir -p "$(dirname "$STAGED_VERIFICATION_LOG")"
log_staged_line() {
    echo "$*" | tee -a "$STAGED_VERIFICATION_LOG"
}

write_focused_readback_init_script() {
    local init_script="$REPO_ROOT/build/tmp/staged-verification-focused-readback.gradle"
    mkdir -p "$(dirname "$init_script")"
    cat > "$init_script" <<'EOF'
settingsEvaluated { settings ->
    def repoRoot = System.getProperty('saltmarcher.repoRootDir', '')
    if (repoRoot == null || repoRoot.trim().isEmpty()) {
        return
    }
    if (new File(repoRoot).canonicalFile != settings.settingsDir.canonicalFile) {
        return
    }
    def selected = System.getProperty('saltmarcher.focusedVerificationPaths', '')
    if (selected == null || selected.trim().isEmpty()) {
        selected = '<none>'
    }
    println("[staged-verification] Focused verification paths: ${selected}")
}
EOF
    printf '%s\n' "$init_script"
}

observable_log_path_from_output() {
    local output_capture="$1"
    local line
    if line="$(grep -E '^\[observable-gradle\] Log file: ' "$output_capture" | tail -n 1)"; then
        printf '%s\n' "${line#*Log file: }"
    fi
}

staged_latest_log_line() {
    local log_path="$1"
    local pattern="$2"
    local line
    if line="$(grep -E "$pattern" "$log_path" | tail -n 1)"; then
        printf '%s\n' "$line"
        return 0
    fi
    return 1
}

copy_observable_retained_summary() {
    local observable_log="$1"
    local line

    if [[ -z "$observable_log" || ! -f "$observable_log" ]]; then
        log_staged_line "[staged-verification] Observable log: not reported"
        return
    fi

    log_staged_line "[staged-verification] Observable log: $observable_log"
    log_staged_line "[staged-verification] Retained observable proof summary:"
    if line="$(staged_latest_log_line "$observable_log" '^\[observable-gradle\] Result: ')"; then
        log_staged_line "[staged-verification] ${line#\[observable-gradle\] }"
    fi
    if line="$(staged_latest_log_line "$observable_log" '^\[observable-gradle\] Elapsed: ')"; then
        log_staged_line "[staged-verification] ${line#\[observable-gradle\] }"
    fi
    if line="$(staged_latest_log_line "$observable_log" '^\[observable-gradle\] Actionable tasks: ')"; then
        log_staged_line "[staged-verification] ${line#\[observable-gradle\] }"
    fi
    if line="$(staged_latest_log_line "$observable_log" '^\[observable-gradle\] Configuration cache: ')"; then
        log_staged_line "[staged-verification] ${line#\[observable-gradle\] }"
    fi
    if line="$(staged_latest_log_line "$observable_log" '^\[staged-verification\] Focused verification paths: ')"; then
        log_staged_line "$line"
    fi
}

log_staged_line "[staged-verification] Wrapper log: $STAGED_VERIFICATION_LOG"

run_surface() {
    local surface="$1"

    log_staged_line "[staged-verification] Surface: $surface"
    log_staged_line ""

    if [[ "$surface" == "production-handoff" ]]; then
        run_project_health_debt_intake "current worktree" --worktree
        request_production_handoff_configuration_cache
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
    local observable_cmd=("$REPO_ROOT/tools/gradle/run-observable-gradle.sh")
    local output_capture observable_status observable_log

    if [[ "$phase_fail_fast" == true ]]; then
        observable_cmd+=(--fail-fast)
    fi
    observable_cmd+=("${task_names[@]}")
    if [[ ${#extra_args[@]} -gt 0 ]]; then
        observable_cmd+=(-- "${extra_args[@]}")
    fi

    output_capture="$(mktemp)"
    set +e
    (
        cd "$REPO_ROOT"
        "${observable_cmd[@]}"
    ) 2>&1 | tee "$output_capture"
    observable_status=${PIPESTATUS[0]}
    set -e

    observable_log="$(observable_log_path_from_output "$output_capture")"
    rm -f "$output_capture"
    copy_observable_retained_summary "$observable_log"
    return "$observable_status"
}

run_focused_handoff() {
    local args=("$@")
    local index=0
    local value normalized area
    local run_compile_integrity=false
    declare -a focused_paths=()
    declare -a explicit_areas=()

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
            normalized="$(normalize_focused_area "$area")" || {
                echo "[staged-verification] Invalid focused area: $area" >&2
                exit 64
            }
            if value="$(append_unique "$normalized" "${explicit_areas[@]}")"; then
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

    log_staged_line "[staged-verification] Focused paths: $(join_by_comma "${focused_paths[@]}")"
    if [[ ${#explicit_areas[@]} -gt 0 ]]; then
        log_staged_line "[staged-verification] Focused areas: ${explicit_areas[*]}"
    else
        log_staged_line "[staged-verification] Focused areas: Gradle-inferred"
    fi
    if [[ "$run_compile_integrity" == true ]]; then
        log_staged_line "[staged-verification] Focused compile integrity: requested"
    else
        log_staged_line "[staged-verification] Focused compile integrity: not requested"
    fi
    log_staged_line ""

    declare -a intake_args=()
    for value in "${focused_paths[@]}"; do
        intake_args+=(--planned-path "$value")
    done
    for value in "${explicit_areas[@]}"; do
        intake_args+=(--planned-owner "$value")
    done
    run_project_health_debt_intake "focused scope" "${intake_args[@]}"

    local focused_paths_property="-Dsaltmarcher.focusedVerificationPaths=$(join_by_comma "${focused_paths[@]}")"
    extra_args=("$focused_paths_property" "${extra_args[@]}")
    if [[ ${#explicit_areas[@]} -gt 0 ]]; then
        local focused_areas_property="-Dsaltmarcher.focusedVerificationAreas=$(join_by_comma "${explicit_areas[@]}")"
        extra_args=("$focused_areas_property" "${extra_args[@]}")
    fi
    if [[ "$run_compile_integrity" == true ]]; then
        extra_args=("-Dsaltmarcher.focusedHandoffCompileIntegrity=true" "${extra_args[@]}")
    fi
    local focused_readback_init_script
    focused_readback_init_script="$(write_focused_readback_init_script)"
    extra_args=("--init-script" "$focused_readback_init_script" "${extra_args[@]}")
    run_observable_gradle "$fail_fast" focused-handoff
}

if [[ "${requested_surfaces[0]}" != "focused-handoff" && ${#requested_surfaces[@]} -ne 1 ]]; then
    echo "[staged-verification] Expected exactly one entrypoint, got ${#requested_surfaces[@]}" >&2
    usage >&2
    exit 64
fi

run_surface "${requested_surfaces[0]}"
