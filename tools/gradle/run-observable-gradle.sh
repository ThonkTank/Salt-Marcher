#!/usr/bin/env bash
set -euo pipefail

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
readonly HEARTBEAT_SECONDS=30

usage() {
    cat <<'EOF'
Usage:
  tools/gradle/run-observable-gradle.sh [--fail-fast] <gradle-task> [<gradle-task> ...] [-- <extra-gradle-args>]

Examples:
  tools/gradle/run-observable-gradle.sh checkDataEnforcement
  tools/gradle/run-observable-gradle.sh --fail-fast compileJava
  tools/gradle/run-observable-gradle.sh checkDomainEnforcement checkDataEnforcement -- --rerun-tasks

Options:
  --fail-fast  Do not add wrapper-owned Gradle --continue.

Reserved wrapper-owned args are ignored when passed through <extra-gradle-args>:
  --console, --project-dir
EOF
}

sanitize_segment() {
    printf '%s' "$1" |
        LC_ALL=C tr -cs 'A-Za-z0-9._-' '-' |
        sed 's/^-*//; s/-*$//' |
        cut -c1-80
}

join_for_log_name() {
    local joined=""
    local item
    for item in "$@"; do
        if [[ -n "$joined" ]]; then
            joined="${joined}__"
        fi
        joined="${joined}$(sanitize_segment "$item")"
    done
    printf '%s' "${joined:-gradle-run}"
}

format_duration() {
    local total_seconds="$1"
    local hours=$((total_seconds / 3600))
    local minutes=$(((total_seconds % 3600) / 60))
    local seconds=$((total_seconds % 60))
    printf '%02dh:%02dm:%02ds' "$hours" "$minutes" "$seconds"
}

is_wrapper_owned_gradle_arg() {
    case "$1" in
      --console|--project-dir|-p)
        return 0
        ;;
      --console=*|--project-dir=*)
        return 0
        ;;
      *)
        return 1
        ;;
    esac
}

wrapper_owned_arg_takes_separate_value() {
    case "$1" in
      --console|--project-dir|-p)
        return 0
        ;;
      *)
        return 1
        ;;
    esac
}

contains_continue_flag() {
    local arg
    for arg in "$@"; do
        if [[ "$arg" == "--continue" ]]; then
            return 0
        fi
    done
    return 1
}

sanitize_extra_args() {
    SANITIZED_EXTRA_ARGS=()
    FILTERED_WRAPPER_OWNED_ARGS=()

    local args=("$@")
    local current_arg=""
    local next_arg=""
    local index=0
    while [[ $index -lt ${#args[@]} ]]; do
        current_arg="${args[$index]}"
        index=$((index + 1))

        if ! is_wrapper_owned_gradle_arg "$current_arg"; then
            SANITIZED_EXTRA_ARGS+=("$current_arg")
            continue
        fi

        FILTERED_WRAPPER_OWNED_ARGS+=("$current_arg")
        if wrapper_owned_arg_takes_separate_value "$current_arg" && [[ $index -lt ${#args[@]} ]]; then
            next_arg="${args[$index]}"
            FILTERED_WRAPPER_OWNED_ARGS+=("$next_arg")
            index=$((index + 1))
        fi
    done
}

print_known_issue_hint() {
    local log_path="$1"

    if grep -q "Could not determine a usable wildcard IP for this machine" "$log_path"; then
        echo "[observable-gradle] Detected Gradle startup environment failure: wildcard IP resolution." >&2
        echo "[observable-gradle] This is an environment issue, not a checker failure." >&2
        return
    fi

    if grep -Eq "Timeout waiting to lock|Waiting to acquire .*build logic queue|buildLogic.lock" "$log_path"; then
        echo "[observable-gradle] Detected Gradle lock contention around build logic or cache state." >&2
        echo "[observable-gradle] Retry after parallel builds stop or use a single combined invocation." >&2
        return
    fi

    if grep -Eq "Broken pipe|client disconnection detected|EOFException|MessageIOException" "$log_path"; then
        echo "[observable-gradle] Detected client or daemon disconnect during a long Gradle run." >&2
        echo "[observable-gradle] The underlying task may have kept running longer than the caller expected." >&2
    fi
}

latest_log_line() {
    local pattern="$1"
    local line
    if line="$(grep -E "$pattern" "$log_file" | tail -n 1)"; then
        printf '%s\n' "$line"
        return 0
    fi
    return 1
}

print_retained_proof_summary() {
    local result="$1"
    local elapsed_seconds="$2"
    local actionable_line
    local cache_line

    {
        echo
        echo "[observable-gradle] Retained proof summary:"
        echo "[observable-gradle] Result: $result"
        echo "[observable-gradle] Elapsed: $(format_duration "$elapsed_seconds")"
        if actionable_line="$(latest_log_line '^[0-9]+ actionable tasks?: ')"; then
            echo "[observable-gradle] Actionable tasks: $actionable_line"
        else
            echo "[observable-gradle] Actionable tasks: not reported"
        fi
        if cache_line="$(latest_log_line '^(Reusing configuration cache\.|Configuration cache entry (reused|stored)\.)')"; then
            echo "[observable-gradle] Configuration cache: $cache_line"
        else
            echo "[observable-gradle] Configuration cache: not reported"
        fi
    } | tee -a "$log_file"
}

if [[ $# -lt 1 ]]; then
    usage >&2
    exit 64
fi

declare -a tasks=()
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
    tasks+=("$1")
    shift
done

if [[ ${#tasks[@]} -eq 0 ]]; then
    usage >&2
    exit 64
fi

if [[ ${#extra_args[@]} -gt 0 ]]; then
    sanitize_extra_args "${extra_args[@]}"
    extra_args=("${SANITIZED_EXTRA_ARGS[@]}")
else
    SANITIZED_EXTRA_ARGS=()
    FILTERED_WRAPPER_OWNED_ARGS=()
fi

if [[ "$fail_fast" == true ]] &&
    { contains_continue_flag "${tasks[@]}" || contains_continue_flag "${extra_args[@]}"; }; then
    echo "[observable-gradle] --fail-fast cannot be combined with Gradle --continue." >&2
    exit 64
fi

cd "$REPO_ROOT"

readonly task_display="${tasks[*]}"
readonly timestamp="$(date +%Y%m%dT%H%M%S%N 2>/dev/null || date +%Y%m%dT%H%M%S)"
readonly log_dir="$REPO_ROOT/build/gradle-run-logs"
readonly log_name="$(join_for_log_name "${tasks[@]}")"
readonly log_file="$log_dir/${timestamp}-pid$$-${log_name}.log"

mkdir -p "$log_dir"

declare -a gradle_cmd=(./gradlew)
gradle_cmd+=("${tasks[@]}")
gradle_cmd+=(--console=plain)
if [[ "$fail_fast" == false ]] && ! contains_continue_flag "${extra_args[@]}"; then
    gradle_cmd+=(--continue)
fi
if [[ ${#extra_args[@]} -gt 0 ]]; then
    gradle_cmd+=("${extra_args[@]}")
fi

echo "[observable-gradle] Repo root: $REPO_ROOT"
echo "[observable-gradle] Tasks: $task_display"
if [[ ${#extra_args[@]} -gt 0 ]]; then
    echo "[observable-gradle] Extra args: ${extra_args[*]}"
fi
if [[ "$fail_fast" == true ]]; then
    echo "[observable-gradle] Failure aggregation: fail-fast"
else
    echo "[observable-gradle] Failure aggregation: --continue"
fi
if [[ ${#FILTERED_WRAPPER_OWNED_ARGS[@]} -gt 0 ]]; then
    echo "[observable-gradle] Ignored wrapper-owned args: ${FILTERED_WRAPPER_OWNED_ARGS[*]}"
fi
echo "[observable-gradle] Log file: $log_file"
echo "[observable-gradle] Command: ${gradle_cmd[*]}"
echo

start_epoch="$(date +%s)"
{
    echo "[observable-gradle] Repo root: $REPO_ROOT"
    echo "[observable-gradle] Tasks: $task_display"
    if [[ ${#extra_args[@]} -gt 0 ]]; then
        echo "[observable-gradle] Extra args: ${extra_args[*]}"
    fi
    if [[ "$fail_fast" == true ]]; then
        echo "[observable-gradle] Failure aggregation: fail-fast"
    else
        echo "[observable-gradle] Failure aggregation: --continue"
    fi
    if [[ ${#FILTERED_WRAPPER_OWNED_ARGS[@]} -gt 0 ]]; then
        echo "[observable-gradle] Ignored wrapper-owned args: ${FILTERED_WRAPPER_OWNED_ARGS[*]}"
    fi
    echo "[observable-gradle] Log file: $log_file"
    echo "[observable-gradle] Command: ${gradle_cmd[*]}"
    printf '[observable-gradle] Started at %(%Y-%m-%d %H:%M:%S %Z)T\n' -1
    echo
} >> "$log_file"

heartbeat_pid=""
gradle_pid=""
signal_forwarded=""

forward_signal() {
    local signal_name="$1"
    signal_forwarded="$signal_name"
    if [[ -n "$gradle_pid" ]] && kill -0 "$gradle_pid" 2>/dev/null; then
        echo "[observable-gradle] Forwarding $signal_name to Gradle pid $gradle_pid" | tee -a "$log_file" >&2
        kill "-$signal_name" "$gradle_pid" 2>/dev/null || true
    fi
}

trap 'forward_signal TERM' TERM
trap 'forward_signal INT' INT

heartbeat() {
    local child_pid="$1"
    while kill -0 "$child_pid" 2>/dev/null; do
        sleep "$HEARTBEAT_SECONDS"
        if ! kill -0 "$child_pid" 2>/dev/null; then
            break
        fi
        local now elapsed
        now="$(date +%s)"
        elapsed=$((now - start_epoch))
        echo "[observable-gradle] Still running after $(format_duration "$elapsed"): $task_display" | tee -a "$log_file"
    done
}

set +e
"${gradle_cmd[@]}" \
    > >(tee -a "$log_file") \
    2> >(tee -a "$log_file" >&2) &
gradle_pid=$!
heartbeat "$gradle_pid" &
heartbeat_pid=$!

wait "$gradle_pid"
gradle_status=$?

if [[ -n "$heartbeat_pid" ]]; then
    kill "$heartbeat_pid" 2>/dev/null || true
    wait "$heartbeat_pid" 2>/dev/null || true
fi
set -e

end_epoch="$(date +%s)"
elapsed_seconds=$((end_epoch - start_epoch))

if [[ $gradle_status -eq 0 ]]; then
    print_retained_proof_summary "success" "$elapsed_seconds"
    echo | tee -a "$log_file"
    echo "[observable-gradle] Gradle finished successfully after $(format_duration "$elapsed_seconds")." | tee -a "$log_file"
    echo "[observable-gradle] Log file: $log_file" | tee -a "$log_file"
    exit 0
fi

print_retained_proof_summary "failure(exit $gradle_status)" "$elapsed_seconds"
echo | tee -a "$log_file" >&2
echo "[observable-gradle] Gradle failed with exit code $gradle_status after $(format_duration "$elapsed_seconds")." | tee -a "$log_file" >&2
if [[ -n "$signal_forwarded" ]]; then
    echo "[observable-gradle] The run was interrupted by signal $signal_forwarded." | tee -a "$log_file" >&2
fi
echo "[observable-gradle] Log file: $log_file" | tee -a "$log_file" >&2
print_known_issue_hint "$log_file"
exit "$gradle_status"
