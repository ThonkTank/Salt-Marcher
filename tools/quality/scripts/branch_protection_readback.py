#!/usr/bin/env python3
"""Read GitHub branch protection and append a qualification note."""

from __future__ import annotations

import json
import os
import subprocess
from datetime import datetime, timezone
from pathlib import Path


REPO = os.environ.get("GITHUB_REPOSITORY", "ThonkTank/Salt-Marcher")
BRANCH = os.environ.get("BRANCH_PROTECTION_BRANCH", "main")
REPO_ROOT = Path(__file__).resolve().parents[3]
JOURNAL = REPO_ROOT / "docs/project/journal" / f"{datetime.now(timezone.utc):%Y-%m}.md"
INTENDED = {
    "production-handoff",
    "warden-freeze",
    "behavior-gate",
    "judge-review",
}


def gh_api(path: str) -> tuple[int, str]:
    result = subprocess.run(
        ["gh", "api", path],
        cwd=REPO_ROOT,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )
    return result.returncode, result.stdout


def classic_contexts(payload: dict) -> set[str]:
    status_checks = payload.get("required_status_checks") or {}
    contexts = set(status_checks.get("contexts") or [])
    for check in status_checks.get("checks") or []:
        context = check.get("context")
        if context:
            contexts.add(context)
    return contexts


def compact_detail(raw: str) -> str:
    text = raw.strip()
    if not text:
        return "empty response"
    try:
        payload = json.loads(text)
    except json.JSONDecodeError:
        return text.splitlines()[-1][:160]
    message = payload.get("message", "unknown GitHub API response")
    status = payload.get("status")
    if status:
        return f"{message} (HTTP {status})"
    return message


def main() -> int:
    timestamp = datetime.now(timezone.utc).isoformat(timespec="seconds")
    actor = os.environ.get("GITHUB_ACTOR", "<local>")
    code, raw = gh_api(f"repos/{REPO}/branches/{BRANCH}/protection")
    observed: set[str] = set()
    status = "Not Qualified"
    detail = compact_detail(raw)
    if code == 0:
        payload = json.loads(raw)
        observed = classic_contexts(payload)
        if observed == INTENDED:
            status = "Qualified"
        elif INTENDED < observed:
            status = "Stricter Drift"
        detail = ", ".join(sorted(observed)) or "<none>"

    entry = (
        f"\n## {timestamp} branch-protection-readback\n\n"
        f"Repository: `{REPO}` branch `{BRANCH}` actor `{actor}`.\n"
        f"Status: `{status}`.\n"
        f"Observed required checks: {detail}.\n"
    )
    JOURNAL.parent.mkdir(parents=True, exist_ok=True)
    with JOURNAL.open("a", encoding="utf-8") as handle:
        handle.write(entry)
    print(entry.strip())
    return 0 if status == "Qualified" else 1


if __name__ == "__main__":
    raise SystemExit(main())
