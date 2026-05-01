#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)

saltmarcher_is_nonblank() {
    [ -n "${1:-}" ]
}

saltmarcher_remove_path() {
    target_path=$1
    [ -e "$target_path" ] || return 0
    rm -rf "$target_path"
}

saltmarcher_copy_dir_if_present() {
    source_path=$1
    target_path=$2
    [ -d "$source_path" ] || return 1
    mkdir -p "$(dirname "$target_path")"
    cp -R "$source_path" "$target_path"
    return 0
}

saltmarcher_prune_old_directories() {
    root_path=$1
    retention_days=$2
    [ -d "$root_path" ] || return 0
    find "$root_path" -mindepth 1 -maxdepth 1 -type d -mtime +"$retention_days" -exec rm -rf {} +
}

saltmarcher_prune_old_files() {
    root_path=$1
    retention_days=$2
    [ -d "$root_path" ] || return 0
    find "$root_path" -mindepth 1 -maxdepth 1 -type f -mtime +"$retention_days" -delete
}

saltmarcher_prune_local_history() {
    saltmarcher_prune_old_directories "${SALTMARCHER_GRADLE_RETAINED_FAILURES_ROOT:-}" 7
    saltmarcher_prune_old_files "$REPO_ROOT/build/gradle-run-logs" 7
}

saltmarcher_export_latest_outputs() {
    latest_output_root=$1
    isolated_build_root=$2
    isolated_root_build=$isolated_build_root/root
    temp_root=$latest_output_root.tmp.$$
    copied_any=false

    [ -d "$isolated_root_build" ] || return 0

    saltmarcher_remove_path "$temp_root"
    mkdir -p "$temp_root"

    if saltmarcher_copy_dir_if_present "$isolated_root_build/libs" "$temp_root/libs"; then
        copied_any=true
    fi
    if saltmarcher_copy_dir_if_present "$isolated_root_build/distributions" "$temp_root/distributions"; then
        copied_any=true
    fi
    if saltmarcher_copy_dir_if_present "$isolated_root_build/packaging" "$temp_root/packaging"; then
        copied_any=true
    fi

    if [ "$copied_any" = true ]; then
        {
            printf 'rawIsolationId=%s\n' "${SALTMARCHER_GRADLE_INVOCATION_ID:-}"
            printf 'isolationSegment=%s\n' "${SALTMARCHER_GRADLE_ISOLATION_SEGMENT:-}"
            printf 'finishedAt=%s\n' "$(date -Iseconds)"
        } > "$temp_root/metadata.properties"
        saltmarcher_remove_path "$latest_output_root"
        mv "$temp_root" "$latest_output_root"
        return 0
    fi

    saltmarcher_remove_path "$temp_root"
}

saltmarcher_retain_failure_diagnostics() {
    retained_failures_root=$1
    isolated_build_root=$2
    gradle_exit_code=$3
    interrupted_signal=$4
    isolated_root_build=$isolated_build_root/root
    retained_run_root=$retained_failures_root/${SALTMARCHER_GRADLE_ISOLATION_SEGMENT:-unknown}
    temp_root=$retained_run_root.tmp.$$
    copied_any=false

    saltmarcher_remove_path "$temp_root"
    mkdir -p "$temp_root"

    if saltmarcher_copy_dir_if_present "$isolated_root_build/reports" "$temp_root/reports"; then
        copied_any=true
    fi
    if saltmarcher_copy_dir_if_present "$isolated_root_build/test-results" "$temp_root/test-results"; then
        copied_any=true
    fi

    {
        printf 'rawIsolationId=%s\n' "${SALTMARCHER_GRADLE_INVOCATION_ID:-}"
        printf 'isolationSegment=%s\n' "${SALTMARCHER_GRADLE_ISOLATION_SEGMENT:-}"
        printf 'exitCode=%s\n' "$gradle_exit_code"
        printf 'interruptedSignal=%s\n' "$interrupted_signal"
        printf 'finishedAt=%s\n' "$(date -Iseconds)"
    } > "$temp_root/metadata.properties"

    if [ "$copied_any" = true ] || [ -s "$temp_root/metadata.properties" ]; then
        mkdir -p "$retained_failures_root"
        saltmarcher_remove_path "$retained_run_root"
        mv "$temp_root" "$retained_run_root"
        return 0
    fi

    saltmarcher_remove_path "$temp_root"
}

saltmarcher_cleanup_current_invocation() {
    saltmarcher_remove_path "${SALTMARCHER_GRADLE_ISOLATED_BUILD_ROOT:-}"
    saltmarcher_remove_path "${SALTMARCHER_GRADLE_ISOLATED_RUNTIME_ROOT:-}"
    saltmarcher_remove_path "${SALTMARCHER_GRADLE_ISOLATED_USER_HOME:-}"
}

saltmarcher_cleanup_ci_completed() {
    saltmarcher_remove_path "$REPO_ROOT/build/isolated-gradle"
    mkdir -p "$REPO_ROOT/build/isolated-gradle"
    saltmarcher_remove_path "$REPO_ROOT/.gradle/isolated-gradle"
    mkdir -p "$REPO_ROOT/.gradle/isolated-gradle"
    saltmarcher_remove_path "$REPO_ROOT/.gradle/isolated-user-home"
    mkdir -p "$REPO_ROOT/.gradle/isolated-user-home"
}

if [ "${1:-}" = "--cleanup-ci-completed" ]; then
    saltmarcher_cleanup_ci_completed
    exit 0
fi

gradle_exit_code=${1:-0}
interrupted_signal=${2:-}

if saltmarcher_is_nonblank "${CI:-}"; then
    exit 0
fi

saltmarcher_prune_local_history

if [ "$gradle_exit_code" -eq 0 ]; then
    saltmarcher_export_latest_outputs \
        "${SALTMARCHER_GRADLE_LATEST_OUTPUT_ROOT:-$REPO_ROOT/build/latest-output}" \
        "${SALTMARCHER_GRADLE_ISOLATED_BUILD_ROOT:-$REPO_ROOT/build/isolated-gradle}"
else
    saltmarcher_retain_failure_diagnostics \
        "${SALTMARCHER_GRADLE_RETAINED_FAILURES_ROOT:-$REPO_ROOT/build/retained-gradle-failures}" \
        "${SALTMARCHER_GRADLE_ISOLATED_BUILD_ROOT:-$REPO_ROOT/build/isolated-gradle}" \
        "$gradle_exit_code" \
        "$interrupted_signal"
fi

saltmarcher_cleanup_current_invocation
