#!/usr/bin/env bash
set -uo pipefail

REPO_URL="${SALTMARCHER_REPO_URL:-https://github.com/ThonkTank/Salt-Marcher.git}"
REPO_FULL_NAME="${SALTMARCHER_REPO_FULL_NAME:-ThonkTank/Salt-Marcher}"
DATA_ROOT="${XDG_DATA_HOME:-$HOME/.local/share}/saltmarcher-autodev"
STATE_ROOT="${XDG_STATE_HOME:-$HOME/.local/state}/saltmarcher/autodev"
REPO_DIR="$DATA_ROOT/repo"
TASK_PROMPT="$DATA_ROOT/task-prompt.md"
QUEUE_DIR="$STATE_ROOT/queue"
QUEUE_DONE_DIR="$STATE_ROOT/queue-done"
QUEUE_ARCHIVE_DIR="$STATE_ROOT/queue-archive"
TELEMETRY_DIR="$STATE_ROOT/telemetry"
LOG_DIR="$STATE_ROOT/logs"
HEARTBEAT_FILE="$STATE_ROOT/heartbeat.jsonl"
RUN_LOCK="$STATE_ROOT/run.lock"
STOP_FILE="$STATE_ROOT/STOP"
FAILURE_FILE="$STATE_ROOT/failure-series"
BACKOFF_FILE="$STATE_ROOT/backoff-minutes"
MAX_SESSION_SECONDS="${AUTODEV_MAX_SESSION_SECONDS:-5400}"
CHECK_WATCH_SECONDS="${AUTODEV_CHECK_WATCH_SECONDS:-2400}"
SESSION_PAUSE_SECONDS="${AUTODEV_SESSION_PAUSE_SECONDS:-600}"
NO_WORK_PAUSE_SECONDS="${AUTODEV_NO_WORK_PAUSE_SECONDS:-3600}"
STOP_PAUSE_SECONDS="${AUTODEV_STOP_PAUSE_SECONDS:-300}"
FAILURE_PAUSE_SECONDS="${AUTODEV_FAILURE_PAUSE_SECONDS:-14400}"

mkdir -p "$DATA_ROOT" "$STATE_ROOT" "$QUEUE_DIR" "$QUEUE_DONE_DIR" "$QUEUE_ARCHIVE_DIR" "$TELEMETRY_DIR" "$LOG_DIR"
exec 9>"$RUN_LOCK"
flock -n 9 || exit 0

log_file="$LOG_DIR/autodev-$(date -u +%Y%m%dT%H%M%SZ).log"
exec > >(tee -a "$log_file") 2>&1

log() {
    printf '%s %s\n' "$(date -Is)" "$*" >&2
}

sleep_interruptible() {
    local seconds="$1"
    if [[ "${AUTODEV_DRY_RUN:-0}" == "1" ]]; then
        log "dry-run sleep skipped seconds=$seconds"
        return 0
    fi
    sleep "$seconds"
}

now_epoch() {
    date -u +%s
}

iso_now() {
    date -u +%Y-%m-%dT%H:%M:%SZ
}

current_day() {
    date +%F
}

current_month_file() {
    printf '%s/%s.jsonl\n' "$TELEMETRY_DIR" "$(date -u +%Y-%m)"
}

next_session_index() {
    local file
    file="$(current_month_file)"
    if [[ -f "$file" ]]; then
        python3 - "$file" <<'PY'
import json, sys
max_index = 0
with open(sys.argv[1], encoding="utf-8") as handle:
    for line in handle:
        try:
            max_index = max(max_index, int(json.loads(line).get("session_index", 0)))
        except Exception:
            pass
print(max_index + 1)
PY
    else
        echo 1
    fi
}

write_jsonl() {
    local file="$1"
    local payload="$2"
    mkdir -p "$(dirname "$file")"
    printf '%s\n' "$payload" >> "$file"
}

quota_json() {
    python3 - "$TELEMETRY_DIR" <<'PY'
import json, os, sys, time
root = sys.argv[1]
now = time.time()
merges = 0
r1 = 0
migrations = 0
judge_runs = 0
for name in sorted(os.listdir(root)) if os.path.isdir(root) else []:
    if not name.endswith(".jsonl"):
        continue
    path = os.path.join(root, name)
    with open(path, encoding="utf-8") as handle:
        for line in handle:
            try:
                item = json.loads(line)
                ended = item.get("ended_at") or item.get("started_at")
                ts = __import__("calendar").timegm(time.strptime(ended, "%Y-%m-%dT%H:%M:%SZ")) if ended else 0
            except Exception:
                continue
            if now - ts <= 24 * 3600:
                if item.get("result") == "merged" and item.get("task_source") != "p0p1":
                    merges += 1
                if item.get("result") == "merged" and item.get("risk_label") == "risk:R1":
                    r1 += 1
                if item.get("judge_verdict") not in (None, "skipped"):
                    judge_runs += 1
            if now - ts <= 7 * 24 * 3600 and item.get("result") == "merged" and item.get("task_source") == "migration":
                migrations += 1
print(json.dumps({"merges_24h": merges, "r1_24h": r1, "migrations_7d": migrations, "judge_runs_24h": judge_runs}))
PY
}

in_exclusive_window() {
    local hhmm
    hhmm="$(date +%H%M)"
    [[ "$hhmm" > "0644" && "$hhmm" < "0731" ]]
}

seconds_until_exclusive_end() {
    python3 - <<'PY'
import datetime as dt
now = dt.datetime.now()
end = now.replace(hour=7, minute=30, second=0, microsecond=0)
if now >= end:
    end += dt.timedelta(days=1)
print(max(60, int((end - now).total_seconds())))
PY
}

ensure_repo() {
    if [[ "${AUTODEV_DRY_RUN:-0}" == "1" ]]; then
        mkdir -p "$REPO_DIR"
        return 0
    fi
    if [[ ! -d "$REPO_DIR/.git" ]]; then
        log "cloning repo $REPO_URL -> $REPO_DIR"
        git clone "$REPO_URL" "$REPO_DIR" || return 1
    fi
    git -C "$REPO_DIR" fetch origin || return 1
    git -C "$REPO_DIR" checkout main || return 1
    git -C "$REPO_DIR" reset --hard origin/main || return 1
    git -C "$REPO_DIR" clean -fd || return 1
    [[ -z "$(git -C "$REPO_DIR" status --porcelain)" ]] || return 1
}

latest_queue_task() {
    find "$QUEUE_DIR" -maxdepth 1 -type f -name '[0-9][0-9]-*.md' -printf '%f\n' | sort | head -n 1
}

latest_queue_path() {
    local task
    task="$(latest_queue_task || true)"
    [[ -n "$task" ]] && printf '%s/%s\n' "$QUEUE_DIR" "$task"
}

queue_id() {
    local task="$1"
    printf '%s\n' "${task%.md}"
}

queue_done_path() {
    local task="$1"
    printf '%s/%s.done\n' "$QUEUE_DONE_DIR" "$(queue_id "$task")"
}

is_attack_queue() {
    local task="$1"
    [[ "$task" == "10-attack-proofs.md" ]]
}

is_attack_pr_result() {
    local result_json="$1"
    python3 - "$result_json" <<'PY'
import json, sys
try:
    item = json.loads(sys.argv[1])
except Exception:
    raise SystemExit(1)
source = item.get("task_source")
risk = item.get("risk_label")
branch = (item.get("branch") or "").lower()
is_attack = risk == "risk:R3c" or branch.startswith("review-test/")
raise SystemExit(0 if is_attack else 1)
PY
}

is_review_test_pr_result() {
    local result_json="$1"
    python3 - "$result_json" <<'PY'
import json, sys
try:
    item = json.loads(sys.argv[1])
except Exception:
    raise SystemExit(1)
branch = (item.get("branch") or "").lower()
raise SystemExit(0 if branch.startswith("review-test/") else 1)
PY
}

review_test_pr_state() {
    local pr="$1"
    local result_json="$2"
    local head
    if is_review_test_pr_result "$result_json"; then
        printf 'review_test\n'
        return 0
    fi
    if ! head="$(gh pr view "$pr" --repo "$REPO_FULL_NAME" --json headRefName --jq '.headRefName // ""' 2>/dev/null)"; then
        printf 'unknown\n'
        return 0
    fi
    if [[ "${head,,}" == review-test/* ]]; then
        printf 'review_test\n'
    elif [[ -n "$head" ]]; then
        printf 'normal\n'
    else
        printf 'unknown\n'
    fi
}

q0_pending() {
    [[ -f "$QUEUE_DIR/05-dauerbetrieb-vertrag.md" ]]
}

merge_quota_limit() {
    if q0_pending; then
        echo 3
    else
        echo 4
    fi
}

quota_mode_for() {
    local quotas="$1"
    local merge_limit="$2"
    python3 - "$quotas" "$merge_limit" <<'PY'
import json, sys
q = json.loads(sys.argv[1])
limit = int(sys.argv[2])
modes = []
if q.get("merges_24h", 0) >= limit:
    modes.append("merge_pressure")
if q.get("r1_24h", 0) >= 1:
    modes.append("r1_pressure")
if q.get("migrations_7d", 0) >= 1:
    modes.append("migration_pressure")
print(",".join(modes) if modes else "normal")
PY
}

run_session() {
    local output_file="$1"
    local quota_mode="$2"
    local queue_task="$3"
    if [[ "${AUTODEV_DRY_RUN:-0}" == "1" ]]; then
        cat > "$output_file" <<'EOF'
dry-run session: setup, prompt dispatch, and result parsing exercised
NIGHTLOOP_RESULT: {"schema_version":1,"task_source":"none","task_title":"Dry-run setup check","risk_label":"risk:R0","branch":null,"pr_number":null,"result":"dry_run_ok","red_checks":[],"judge_verdict":"skipped","files_changed":0,"lines_changed":0,"retries_within_session":0,"blocker":null,"refactor_signals":["dry-run telemetry validation"],"process_signals":["dry-run report update validation"]}
EOF
        return 0
    fi
    (
        cd "$REPO_DIR" || exit 2
        AUTODEV_STATE_ROOT="$STATE_ROOT" AUTODEV_QUEUE_DIR="$QUEUE_DIR" AUTODEV_QUEUE_DONE_DIR="$QUEUE_DONE_DIR" \
            AUTODEV_QUEUE_TASK="$queue_task" AUTODEV_QUOTA_MODE="$quota_mode" \
            nice -n 19 ionice -c 3 timeout "$MAX_SESSION_SECONDS" codex exec --cd "$REPO_DIR" "$(cat "$TASK_PROMPT")"
    ) > "$output_file" 2>&1
}

extract_result_json() {
    local output_file="$1"
    python3 - "$output_file" <<'PY'
import sys
prefix = "NIGHTLOOP_RESULT:"
last = None
with open(sys.argv[1], encoding="utf-8", errors="replace") as handle:
    for line in handle:
        if prefix in line:
            last = line.split(prefix, 1)[1].strip()
if last:
    print(last)
PY
}

looks_like_provider_limit() {
    local output_file="$1"
    grep -Eiq 'rate.?limit|quota|credit|429|too many requests|overloaded|capacity' "$output_file"
}

current_backoff_minutes() {
    if [[ -f "$BACKOFF_FILE" ]]; then
        cat "$BACKOFF_FILE"
    else
        echo 15
    fi
}

advance_backoff_minutes() {
    local current="$1"
    local next=$(( current * 2 ))
    (( next > 120 )) && next=120
    echo "$next" > "$BACKOFF_FILE"
}

reset_backoff() {
    rm -f "$BACKOFF_FILE"
}

failure_series() {
    if [[ -f "$FAILURE_FILE" ]]; then
        cat "$FAILURE_FILE"
    else
        echo 0
    fi
}

set_failure_series() {
    echo "$1" > "$FAILURE_FILE"
}

increment_failure_series() {
    local value
    value="$(failure_series)"
    value=$(( value + 1 ))
    set_failure_series "$value"
    echo "$value"
}

red_checks_json() {
    local pr="$1"
    gh pr checks "$pr" --repo "$REPO_FULL_NAME" --json name,state,conclusion --jq '[.[] | select((.state != "SUCCESS") and (.conclusion != "SUCCESS")) | .name]' 2>/dev/null || echo '[]'
}

comment_pr() {
    local pr="$1"
    local body="$2"
    gh pr comment "$pr" --repo "$REPO_FULL_NAME" --body "$body" >/dev/null 2>&1 || true
}

comment_pr_telemetry() {
    local telemetry="$1"
    local pr
    pr="$(python3 - "$telemetry" <<'PY'
import json, sys
item = json.loads(sys.argv[1])
print(item.get("pr_number") or "")
PY
)"
    [[ -z "$pr" || "$pr" == "null" ]] && return 0
    comment_pr "$pr" "Autodev telemetry:\n\n\`\`\`json\n$telemetry\n\`\`\`"
}

process_pr_result() {
    local result_json="$1"
    local output_file="$2"
    python3 - "$result_json" <<'PY'
import json, sys
try:
    item = json.loads(sys.argv[1])
except Exception:
    print("")
    sys.exit(0)
print(item.get("pr_number") or "")
PY
}

block_pr_json() {
    local result_json="$1"
    local blocker="$2"
    python3 - "$result_json" "$blocker" <<'PY'
import json, sys
item = json.loads(sys.argv[1])
item["result"] = "blocked"
item["blocker"] = sys.argv[2]
print(json.dumps(item, ensure_ascii=False, separators=(",", ":")))
PY
}

merged_pr_json() {
    local result_json="$1"
    python3 - "$result_json" <<'PY'
import json, sys
item = json.loads(sys.argv[1])
item["result"] = "merged"
item["red_checks"] = []
item["blocker"] = None
print(json.dumps(item, ensure_ascii=False, separators=(",", ":")))
PY
}

ready_open_pr_for_idle_scan() {
    local started_at="$1"
    python3 - "$started_at" "$REPO_FULL_NAME" <<'PY'
import datetime as dt, json, subprocess, sys
started_at, repo = sys.argv[1:3]
try:
    started = dt.datetime.fromisoformat(started_at.replace("Z", "+00:00"))
    result = subprocess.run(
        [
            "gh", "pr", "list", "--repo", repo, "--state", "open", "--limit", "50",
            "--json", "number,title,headRefName,labels,isDraft,mergeStateStatus,createdAt,statusCheckRollup",
        ],
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        check=True,
    )
    prs = json.loads(result.stdout or "[]")
except Exception:
    raise SystemExit(0)
allowed = {"risk:R0", "risk:R1", "risk:R2", "risk:R3a", "risk:R3b", "risk:R3c"}
for pr in prs:
    labels = {label.get("name", "") for label in pr.get("labels") or []}
    head = (pr.get("headRefName") or "").lower()
    try:
        created = dt.datetime.fromisoformat((pr.get("createdAt") or "").replace("Z", "+00:00"))
    except Exception:
        continue
    checks = pr.get("statusCheckRollup") or []
    if not (labels & allowed):
        continue
    if pr.get("isDraft") or pr.get("mergeStateStatus") != "CLEAN":
        continue
    if head.startswith("review-test/") or not created < started:
        continue
    if not checks or any(check.get("conclusion") != "SUCCESS" for check in checks):
        continue
    print(json.dumps({
        "pr_number": pr.get("number"),
        "branch": pr.get("headRefName"),
        "risk_label": sorted(labels & allowed)[-1],
        "task_title": pr.get("title") or "Existing green PR",
    }, separators=(",", ":")))
    break
PY
}

attach_pr_json() {
    local result_json="$1"
    local pr_json="$2"
    python3 - "$result_json" "$pr_json" <<'PY'
import json, sys
item = json.loads(sys.argv[1])
pr = json.loads(sys.argv[2])
for key in ("pr_number", "branch", "risk_label", "task_title"):
    if pr.get(key) is not None:
        item[key] = pr[key]
signals = item.setdefault("process_signals", [])
signals.append("Wrapper selected existing green open PR during idle scan.")
print(json.dumps(item, ensure_ascii=False, separators=(",", ":")))
PY
}

existing_pr_result_json() {
    local pr_json="$1"
    python3 - "$pr_json" <<'PY'
import json, sys
pr = json.loads(sys.argv[1])
signals = ["Wrapper selected existing green open PR before launching a Codex session."]
print(json.dumps({
    "schema_version": 1,
    "task_source": "existing-pr",
    "task_title": pr.get("task_title") or "Existing green PR",
    "risk_label": pr.get("risk_label") or "risk:R0",
    "branch": pr.get("branch"),
    "pr_number": pr.get("pr_number"),
    "result": "pr_opened",
    "red_checks": [],
    "judge_verdict": "unknown",
    "files_changed": 0,
    "lines_changed": 0,
    "retries_within_session": 0,
    "blocker": None,
    "refactor_signals": [],
    "process_signals": signals,
}, ensure_ascii=False, separators=(",", ":")))
PY
}

pr_auto_promote_risk_allowed() {
    local pr="$1"
    local labels_json
    labels_json="$(gh pr view "$pr" --repo "$REPO_FULL_NAME" --json labels --jq '[.labels[].name]' 2>/dev/null || true)"
    python3 - "$labels_json" <<'PY'
import json, sys
try:
    labels = set(json.loads(sys.argv[1] or "[]"))
except Exception:
    raise SystemExit(1)
allowed = {"risk:R0", "risk:R1", "risk:R2", "risk:R3a", "risk:R3b", "risk:R3c"}
raise SystemExit(0 if labels & allowed else 1)
PY
}

attack_pr_final_json() {
    local result_json="$1"
    local pr="$2"
    timeout "$CHECK_WATCH_SECONDS" gh pr checks "$pr" --repo "$REPO_FULL_NAME" --watch >&2 || true
    local red merged
    red="$(red_checks_json "$pr")"
    merged="$(gh pr view "$pr" --repo "$REPO_FULL_NAME" --json mergedAt --jq '.mergedAt // ""' 2>/dev/null || true)"
    if [[ -n "$merged" || "$red" == "[]" ]]; then
        comment_pr "$pr" "P0: Angriffs-PR wurde nicht rot. Dieser PR bleibt ungemerged; Autodev behandelt die betroffene Gate-Instrumentierung als naechstes Reparaturziel."
        python3 - "$result_json" "$red" <<'PY'
import json, sys
item = json.loads(sys.argv[1])
item["result"] = "blocked"
item["red_checks"] = json.loads(sys.argv[2])
item["blocker"] = "P0: attack proof PR did not fail required gates; gate instrumentation repair required"
item.setdefault("process_signals", []).append("attack proof became repair target without STOP")
print(json.dumps(item, ensure_ascii=False, separators=(",", ":")))
PY
    else
        comment_pr "$pr" "Angriffsbeweis erfolgreich: dieser PR bleibt unmerged und wird geschlossen. Rote/unklare Checks: \`$red\`."
        gh pr close "$pr" --repo "$REPO_FULL_NAME" --comment "Angriffsbeweis abgeschlossen; PR wird nie gemerged." >/dev/null 2>&1 || true
        python3 - "$result_json" "$red" <<'PY'
import json, sys
item = json.loads(sys.argv[1])
item["result"] = "pr_open_red"
item["red_checks"] = json.loads(sys.argv[2])
item.setdefault("process_signals", []).append("attack proof PR closed without merge")
print(json.dumps(item, ensure_ascii=False, separators=(",", ":")))
PY
    fi
}

merge_if_pr_opened() {
    local result_json="$1"
    local output_file="$2"
    local queue_task="$3"
    local quotas="$4"
    local merge_limit="$5"
    local started_at="$6"
    local session_result
    session_result="$(python3 - "$result_json" <<'PY'
import json, sys
try:
    print(json.loads(sys.argv[1]).get("result", ""))
except Exception:
    print("")
PY
)"
    local pr
    pr="$(process_pr_result "$result_json" "$output_file")"
    if [[ -z "$pr" || "$pr" == "null" ]]; then
        printf '%s\n' "$result_json"
        return 0
    fi

    if [[ "$session_result" != "pr_opened" && "$session_result" != "blocked" ]]; then
        printf '%s\n' "$result_json"
        return 0
    fi

    local review_state
    review_state="$(review_test_pr_state "$pr" "$result_json")"
    case "$review_state" in
        review_test)
            log "review-test PR #$pr will never be auto-merged"
            attack_pr_final_json "$result_json" "$pr"
            return 0
            ;;
        unknown)
            comment_pr "$pr" "Autodev laesst Auto-Merge offen und behandelt den unlesbaren headRefName als Diagnoseziel."
            block_pr_json "$result_json" "PR headRefName could not be confirmed; refusing auto-merge"
            return 0
            ;;
    esac

    if is_attack_queue "$queue_task" && is_attack_pr_result "$result_json"; then
        log "attack proof PR #$pr will never be auto-merged"
        attack_pr_final_json "$result_json" "$pr"
        return 0
    fi

    local already_merged
    already_merged="$(gh pr view "$pr" --repo "$REPO_FULL_NAME" --json mergedAt --jq '.mergedAt // ""' 2>/dev/null || true)"
    if [[ -n "$already_merged" ]]; then
        merged_pr_json "$result_json"
        return 0
    fi

    if [[ "$session_result" == "blocked" ]]; then
        printf '%s\n' "$result_json"
        return 0
    fi
    if ! pr_auto_promote_risk_allowed "$pr"; then
        printf '%s\n' "$result_json"
        return 0
    fi

    log "enabling auto-merge for PR #$pr"
    if ! gh pr merge "$pr" --repo "$REPO_FULL_NAME" --squash --auto >&2; then
        local red
        red="$(red_checks_json "$pr")"
        comment_pr "$pr" "Autodev konnte Auto-Merge nicht aktivieren. Rote/unklare Checks: \`$red\`."
        python3 - "$result_json" "$red" <<'PY'
import json, sys
item = json.loads(sys.argv[1])
item["result"] = "pr_open_red"
item["red_checks"] = json.loads(sys.argv[2])
print(json.dumps(item, ensure_ascii=False, separators=(",", ":")))
PY
        return 0
    fi

    timeout "$CHECK_WATCH_SECONDS" gh pr checks "$pr" --repo "$REPO_FULL_NAME" --watch >&2 || true
    local merged
    merged="$(gh pr view "$pr" --repo "$REPO_FULL_NAME" --json mergedAt --jq '.mergedAt // ""' 2>/dev/null || true)"
    if [[ -n "$merged" ]]; then
        python3 - "$result_json" <<'PY'
import json, sys
item = json.loads(sys.argv[1])
item["result"] = "merged"
item["red_checks"] = []
print(json.dumps(item, ensure_ascii=False, separators=(",", ":")))
PY
    else
        local red
        red="$(red_checks_json "$pr")"
        comment_pr "$pr" "Autodev laesst diesen PR offen und behandelt rote/unklare Checks als Reparaturziel: \`$red\`."
        python3 - "$result_json" "$red" <<'PY'
import json, sys
item = json.loads(sys.argv[1])
item["result"] = "pr_open_red"
item["red_checks"] = json.loads(sys.argv[2])
item.setdefault("process_signals", []).append("red checks converted to autonomous repair target")
print(json.dumps(item, ensure_ascii=False, separators=(",", ":")))
PY
    fi
}

maybe_archive_queue_task() {
    local queue_task="$1"
    local telemetry="$2"
    [[ -z "$queue_task" ]] && return 0
    local queue_file="$QUEUE_DIR/$queue_task"
    [[ -f "$queue_file" ]] || return 0
    local done_file
    done_file="$(queue_done_path "$queue_task")"
    local result
    result="$(python3 - "$telemetry" <<'PY'
import json, sys
print(json.loads(sys.argv[1]).get("result", ""))
PY
)"
    if [[ -f "$done_file" ]]; then
        local stamp archive_name
        stamp="$(date -u +%Y%m%dT%H%M%SZ)"
        archive_name="$stamp-$queue_task"
        {
            printf 'Archived: %s\n' "$(iso_now)"
            printf 'Telemetry: %s\n\n' "$telemetry"
            cat "$queue_file"
            if [[ -f "$done_file" ]]; then
                printf '\n\nDone evidence:\n'
                cat "$done_file"
            fi
        } > "$QUEUE_ARCHIVE_DIR/$archive_name"
        rm -f "$queue_file" "$done_file"
        log "archived queue task $queue_task -> $archive_name"
    fi
}

normalize_telemetry() {
    local result_json="$1"
    local session_index="$2"
    local started_at="$3"
    local ended_at="$4"
    local wall_minutes="$5"
    local day="$6"
    python3 - "$result_json" "$session_index" "$started_at" "$ended_at" "$wall_minutes" "$day" <<'PY'
import json, sys, datetime as dt
raw, index, started, ended, wall, day = sys.argv[1:7]
try:
    item = json.loads(raw)
except Exception:
    item = {}
defaults = {
    "schema_version": 1,
    "day": day,
    "session_index": int(index),
    "started_at": started,
    "ended_at": ended,
    "task_source": "none",
    "task_title": "unknown",
    "risk_label": "risk:R0",
    "branch": None,
    "pr_number": None,
    "result": "crash",
    "red_checks": [],
    "judge_verdict": "unknown",
    "wall_minutes": int(wall),
    "files_changed": 0,
    "lines_changed": 0,
    "retries_within_session": 0,
    "blocker": None,
    "refactor_signals": [],
    "process_signals": [],
}
for key, value in defaults.items():
    item.setdefault(key, value)
item["schema_version"] = 1
item["day"] = day
item["session_index"] = int(index)
item["started_at"] = started
item["ended_at"] = ended
item["wall_minutes"] = int(wall)
for list_key in ("red_checks", "refactor_signals", "process_signals"):
    if not isinstance(item.get(list_key), list):
        item[list_key] = []
print(json.dumps(item, ensure_ascii=False, separators=(",", ":")))
PY
}

retire_legacy_idle_result() {
    local result_json="$1"
    python3 - "$result_json" <<'PY'
import json, sys
item = json.loads(sys.argv[1])
if item.get("result") == "no_work":
    item["result"] = "blocked"
    item["blocker"] = "Runner emitted retired no_work result; scout contract repair required"
    item.setdefault("process_signals", []).append("retired no_work result converted to repair target")
print(json.dumps(item, ensure_ascii=False, separators=(",", ":")))
PY
}

build_report_body() {
    local day="$1"
    python3 - "$TELEMETRY_DIR" "$day" "$REPO_FULL_NAME" <<'PY'
import json, os, sys, time
root, day, repo = sys.argv[1:4]
items = []
for name in sorted(os.listdir(root)) if os.path.isdir(root) else []:
    if name.endswith(".jsonl"):
        with open(os.path.join(root, name), encoding="utf-8") as handle:
            for line in handle:
                try:
                    item = json.loads(line)
                except Exception:
                    continue
                if item.get("day") == day:
                    items.append(item)
items.sort(key=lambda item: item.get("started_at", ""))
merged = [i for i in items if i.get("result") == "merged"]
red = [i for i in items if i.get("result") == "pr_open_red"]
blocked = [i for i in items if i.get("result") in {"blocked", "crash", "timeout", "backoff"}]
signals_process = []
signals_refactor = []
for item in items:
    for signal in item.get("process_signals") or []:
        if signal not in signals_process:
            signals_process.append(signal)
    for signal in item.get("refactor_signals") or []:
        if signal not in signals_refactor:
            signals_refactor.append(signal)
merges_24h = sum(1 for i in items if i.get("result") == "merged")
r1_24h = sum(1 for i in items if i.get("result") == "merged" and i.get("risk_label") == "risk:R1")
judge_runs = sum(1 for i in items if i.get("judge_verdict") not in (None, "skipped"))
backoff_minutes = sum(int(i.get("wall_minutes") or 0) for i in items if i.get("result") == "backoff")
finalized = time.strftime("%H:%M") >= "06:30"
summary = (
    f"Es wurden {len(items)} Sessions versucht und {len(merged)} PRs gemerged. "
    f"Groesstes Ergebnis: {merged[-1].get('task_title') if merged else 'noch kein Merge'}. "
    f"Naechstes Reparaturziel: {blocked[-1].get('blocker') if blocked else 'keines erfasst'}."
)
lines = [
    f"# Autodev-Tagesbericht {day}",
    "",
    "## Kurzfazit",
    summary if finalized or items else "Live-Stand: noch keine abgeschlossene Session.",
    "",
    "## Erledigt:",
]
if merged:
    for item in merged:
        pr = item.get("pr_number")
        link = f"https://github.com/{repo}/pull/{pr}" if pr else "(ohne PR-Link)"
        lines.append(f"- {link} - {item.get('risk_label', 'risk:?')} - {item.get('task_title', 'ohne Titel')}")
else:
    lines.append("- Noch keine Merges.")
lines += ["", "## Liegengeblieben:"]
if red:
    for item in red:
        pr = item.get("pr_number")
        checks = ", ".join(item.get("red_checks") or ["unbekannt"])
        lines.append(f"- PR #{pr}: rote/unklare Checks: {checks}")
else:
    lines.append("- Keine offenen roten PRs aus dem Autodev-Loop.")
lines += ["", "## Reparaturziele/Anomalien:"]
if blocked:
    for item in blocked:
        lines.append(f"- {item.get('result')}: {item.get('blocker') or item.get('task_title')}")
else:
    lines.append("- Keine Reparaturziele oder Anomalien erfasst.")
lines += ["", "## Beobachtungen fuer Prozess & Refactoring:"]
lines.append("Prozess:")
lines.extend([f"- {s}" for s in signals_process[:20]] or ["- Keine Prozesssignale erfasst."])
lines.append("Refactoring:")
lines.extend([f"- {s}" for s in signals_refactor[:20]] or ["- Keine Refactor-Signale erfasst."])
lines += [
    "",
    "## Verbrauch & Quoten:",
    f"- Sessions: {len(items)}",
    f"- Merges beobachtet: {merges_24h}",
    f"- R1-Slices beobachtet: {r1_24h}",
    f"- Backoff-Minuten: {backoff_minutes}",
    f"- Judge-Laeufe: {judge_runs}",
    "",
    "## Steuerung:",
    "- Pausieren: `touch ~/.local/state/saltmarcher/autodev/STOP`",
    "- Weiterlaufen lassen: `rm ~/.local/state/saltmarcher/autodev/STOP`",
    "- Dauerhaft stoppen: `systemctl --user disable --now saltmarcher-autodev.service`",
    "- Verhaltens-Veto: Issue/Label `abnahme-abgelehnt` verwenden.",
]
print("\n".join(lines))
PY
}

ensure_report_issue() {
    local day="$1"
    local body_file="$2"
    local title="Autodev-Tagesbericht $day"
    local label="autodev-bericht"
    local issue
    gh label create "$label" --repo "$REPO_FULL_NAME" --description "Live-Bericht des SaltMarcher Autodev-Dauerbetriebs" --color "1D76DB" >/dev/null 2>&1 || true
    issue="$(gh issue list --repo "$REPO_FULL_NAME" --state all --label "$label" --search "$title in:title" --json number,title --jq ".[] | select(.title == \"$title\") | .number" | head -n 1)"
    if [[ -z "$issue" ]]; then
        gh issue create --repo "$REPO_FULL_NAME" --title "$title" --label "$label" --body-file "$body_file"
    else
        gh issue edit "$issue" --repo "$REPO_FULL_NAME" --body-file "$body_file" >/dev/null
        echo "https://github.com/$REPO_FULL_NAME/issues/$issue"
    fi
}

dry_run_report_issue() {
    local day="$1"
    local body_file="$2"
    log "dry-run report retained locally at $body_file"
    echo "dry-run-report:$body_file"
}

update_report() {
    local day="$1"
    local body_file="$STATE_ROOT/report-$day.md"
    build_report_body "$day" > "$body_file"
    if [[ "${AUTODEV_DRY_RUN:-0}" == "1" ]]; then
        dry_run_report_issue "$day" "$body_file"
    else
        ensure_report_issue "$day" "$body_file"
    fi
}

write_heartbeat() {
    local telemetry="$1"
    python3 - "$telemetry" <<'PY' >> "$HEARTBEAT_FILE"
import json, sys, time
item = json.loads(sys.argv[1])
print(json.dumps({"at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "session_index": item.get("session_index"), "result": item.get("result")}, separators=(",", ":")))
PY
}

run_loop_once() {
    local session_index started_epoch started_at output_file
    session_index="$(next_session_index)"
    started_epoch="$(now_epoch)"
    started_at="$(iso_now)"
    output_file="$LOG_DIR/session-$session_index-$(date -u +%Y%m%dT%H%M%SZ).out"

    if [[ -f "$STOP_FILE" ]]; then
        log "STOP file present; waiting"
        sleep_interruptible "$STOP_PAUSE_SECONDS"
        return 0
    fi

    if in_exclusive_window; then
        local wait_seconds
        wait_seconds="$(seconds_until_exclusive_end)"
        log "exclusive updater window active; sleeping seconds=$wait_seconds"
        sleep_interruptible "$wait_seconds"
        return 0
    fi

    if ! ensure_repo; then
        local ended_at wall_minutes telemetry telemetry_file
        ended_at="$(iso_now)"
        wall_minutes=$(( ($(now_epoch) - started_epoch + 59) / 60 ))
        telemetry="$(normalize_telemetry '{"result":"blocked","task_source":"none","task_title":"Repository refresh repair","risk_label":"risk:R0","blocker":"Working clone refresh failed or checkout was not clean; repair retry required","judge_verdict":"skipped","red_checks":[],"refactor_signals":[],"process_signals":["repo refresh converted to repair retry"]}' "$session_index" "$started_at" "$ended_at" "$wall_minutes" "$(current_day)")"
        telemetry_file="$(current_month_file)"
        write_jsonl "$telemetry_file" "$telemetry"
        write_heartbeat "$telemetry"
        update_report "$(current_day)"
        increment_failure_series >/dev/null
        sleep_interruptible "$SESSION_PAUSE_SECONDS"
        return 0
    fi

    local quotas quota_mode merge_limit queue_task
    quotas="$(quota_json)"
    merge_limit="$(merge_quota_limit)"
    quota_mode="$(quota_mode_for "$quotas" "$merge_limit")"
    queue_task="$(latest_queue_task || true)"
    if [[ "$quota_mode" != "normal" ]]; then
        log "backpressure telemetry active; mode=$quota_mode quotas=$quotas merge_reference=$merge_limit"
    fi

    local result_json exit_code ended_epoch ended_at wall_minutes final_json telemetry telemetry_file result ready_pr
    log "starting session index=$session_index quota_mode=$quota_mode queue_task=$queue_task"

    ready_pr=""
    if [[ "${AUTODEV_DRY_RUN:-0}" != "1" ]]; then
        ready_pr="$(ready_open_pr_for_idle_scan "$started_at")"
    fi
    if [[ -n "$ready_pr" ]]; then
        log "existing green PR selected before Codex session"
        result_json="$(existing_pr_result_json "$ready_pr")"
        exit_code=0
        printf 'idle scan selected existing green PR\nNIGHTLOOP_RESULT: %s\n' "$result_json" > "$output_file"
    else
        run_session "$output_file" "$quota_mode" "$queue_task"
        exit_code=$?
        result_json="$(extract_result_json "$output_file")"
    fi
    ended_epoch="$(now_epoch)"
    ended_at="$(iso_now)"
    wall_minutes=$(( (ended_epoch - started_epoch + 59) / 60 ))

    if [[ -z "$result_json" ]]; then
        if [[ "$exit_code" == "124" ]]; then
            result_json='{"result":"timeout","task_source":"none","task_title":"Codex session timeout","risk_label":"risk:R0","blocker":"Session timed out before NIGHTLOOP_RESULT","judge_verdict":"unknown","red_checks":[],"refactor_signals":[],"process_signals":["session timeout before telemetry line"]}'
        elif looks_like_provider_limit "$output_file"; then
            local backoff
            backoff="$(current_backoff_minutes)"
            result_json="{\"result\":\"backoff\",\"task_source\":\"none\",\"task_title\":\"Provider capacity backoff\",\"risk_label\":\"risk:R0\",\"blocker\":\"Implementer CLI provider capacity exhausted; backoff ${backoff} minutes\",\"judge_verdict\":\"skipped\",\"red_checks\":[],\"refactor_signals\":[],\"process_signals\":[\"provider capacity backoff\"]}"
            advance_backoff_minutes "$backoff"
            sleep_interruptible "$(( backoff * 60 ))"
        else
            result_json='{"result":"crash","task_source":"none","task_title":"Codex session crash","risk_label":"risk:R0","blocker":"Session ended without parseable NIGHTLOOP_RESULT","judge_verdict":"unknown","red_checks":[],"refactor_signals":[],"process_signals":["unparseable session result"]}'
        fi
    fi
    result_json="$(retire_legacy_idle_result "$result_json")"

    quotas="$(quota_json)"
    merge_limit="$(merge_quota_limit)"
    final_json="$(merge_if_pr_opened "$result_json" "$output_file" "$queue_task" "$quotas" "$merge_limit" "$started_at")"
    telemetry="$(normalize_telemetry "$final_json" "$session_index" "$started_at" "$ended_at" "$wall_minutes" "$(current_day)")"
    telemetry_file="$(current_month_file)"
    write_jsonl "$telemetry_file" "$telemetry"
    write_heartbeat "$telemetry"
    comment_pr_telemetry "$telemetry"
    maybe_archive_queue_task "$queue_task" "$telemetry"
    update_report "$(current_day)"

    result="$(python3 - "$telemetry" <<'PY'
import json, sys
print(json.loads(sys.argv[1]).get("result", "unknown"))
PY
)"
    case "$result" in
        merged|queue_done|dry_run_ok|pr_opened|pr_open_red|blocked)
            set_failure_series 0
            reset_backoff
            ;;
        *)
            local failures
            failures="$(increment_failure_series)"
            log "failure series now $failures"
            if (( failures >= 3 )); then
                set_failure_series 0
                log "failure series threshold reached; sleeping seconds=$FAILURE_PAUSE_SECONDS"
                sleep_interruptible "$FAILURE_PAUSE_SECONDS"
            fi
            ;;
    esac

    sleep_interruptible "$SESSION_PAUSE_SECONDS"
}

main() {
    log "saltmarcher autodev starting dry_run=${AUTODEV_DRY_RUN:-0} once=${AUTODEV_ONCE:-0}"
    while true; do
        run_loop_once
        if [[ "${AUTODEV_ONCE:-0}" == "1" || "${AUTODEV_DRY_RUN:-0}" == "1" ]]; then
            log "single-loop mode complete"
            break
        fi
    done
}

main "$@"
