#!/usr/bin/env bash
# Own service and clients together, without resource budgets or role locks.
set -euo pipefail
qa_program_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
if [[ "${1:-}" != '--owned' ]]; then
    exec python3 "${HOME}/.local/bin/codex-ui-session" bash "$0" --owned "$@"
fi
shift
qa_adapter=$(python3 -B -c 'import json,sys; print(json.load(open(sys.argv[1]))["qa_adapter"])' "$qa_program_root/PROJECT.json")
qa_session="$1"
qa_output="$2"
mkdir -p "$qa_output"
python3 -u -B "$qa_adapter/src/service.py" --session "$qa_session" >"$qa_output/service.log" 2>&1 &
qa_service_pid=$!
printf 'SERVICE_PID=%s SESSION=%s\n' "$qa_service_pid" "$qa_adapter/sessions/$qa_session"
while IFS= read -r qa_request || [[ -n "$qa_request" ]]; do
    if [[ "$qa_request" == 'JOB_EXIT' ]]; then
        wait "$qa_service_pid"
        printf 'NORMAL_JOB_EXIT\n'
        exit 0
    fi
    python3 -B "$qa_adapter/src/client.py" "$qa_adapter/sessions/$qa_session" "$qa_request"
done
wait "$qa_service_pid"
