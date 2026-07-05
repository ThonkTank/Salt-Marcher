#!/usr/bin/env python3
"""Anthropic-backed independent PR judge for R1+ SaltMarcher changes."""

from __future__ import annotations

import json
import os
import subprocess
import sys
import urllib.error
import urllib.request
from datetime import date
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
R1_PLUS = {"risk:R1", "risk:R2", "risk:R3a", "risk:R3b", "risk:R3c"}
DEFAULT_MODEL = "claude-sonnet-4-6"
COUNTER = Path(os.environ.get("JUDGE_COUNTER_FILE", REPO_ROOT / "build/judge-review-counter.json"))
LENS_FILES = [
    REPO_ROOT / "tools/quality/skills/lens-architecture/SKILL.md",
    REPO_ROOT / "tools/quality/skills/lens-code-quality/SKILL.md",
    REPO_ROOT / "tools/quality/skills/lens-security/SKILL.md",
]


def event_payload() -> dict:
    path = os.environ.get("GITHUB_EVENT_PATH")
    if not path or not Path(path).is_file():
        return {}
    return json.loads(Path(path).read_text(encoding="utf-8"))


def pr_labels(payload: dict) -> set[str]:
    event_labels = {label.get("name", "") for label in (payload.get("pull_request") or {}).get("labels", [])}
    if event_labels:
        return event_labels
    if os.environ.get("GITHUB_EVENT_NAME") != "merge_group":
        return event_labels
    return merge_group_labels(payload)


def merge_group_labels(payload: dict) -> set[str]:
    token = os.environ.get("GITHUB_TOKEN")
    repository = os.environ.get("GITHUB_REPOSITORY")
    head_ref = (payload.get("merge_group") or {}).get("head_ref", "")
    if not token or not repository or not head_ref:
        return set()
    branch = head_ref.rsplit("/", 1)[-1]
    result = subprocess.run(
        ["gh", "pr", "list", "--repo", repository, "--state", "open", "--head", branch, "--json", "labels"],
        cwd=REPO_ROOT,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        env={**os.environ, "GH_TOKEN": token},
    )
    if result.returncode != 0:
        return set()
    prs = json.loads(result.stdout or "[]")
    if not prs:
        return set()
    return {label.get("name", "") for label in prs[0].get("labels", [])}


def increment_counter(limit: int) -> bool:
    today = date.today().isoformat()
    COUNTER.parent.mkdir(parents=True, exist_ok=True)
    state = {"date": today, "count": 0}
    if COUNTER.is_file():
        state.update(json.loads(COUNTER.read_text(encoding="utf-8")))
    if state.get("date") != today:
        state = {"date": today, "count": 0}
    state["count"] = int(state.get("count", 0)) + 1
    COUNTER.write_text(json.dumps(state), encoding="utf-8")
    return state["count"] <= limit


def git_output(args: list[str]) -> str:
    return subprocess.check_output(args, cwd=REPO_ROOT, text=True, stderr=subprocess.STDOUT)


def diff_text(base_ref: str) -> str:
    subprocess.run(
        ["git", "fetch", "--no-tags", "origin", base_ref],
        cwd=REPO_ROOT,
        check=False,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    diff = git_output(["git", "diff", f"origin/{base_ref}...HEAD"])
    if len(diff) <= 60000:
        return diff
    files = git_output(["git", "diff", "--name-only", f"origin/{base_ref}...HEAD"])
    stat = git_output(["git", "diff", "--stat", f"origin/{base_ref}...HEAD"])
    largest = git_output(["git", "diff", "--numstat", f"origin/{base_ref}...HEAD"]).splitlines()
    ranked = sorted(
        largest,
        key=lambda line: sum(int(part) for part in line.split("\t")[:2] if part.isdigit()),
        reverse=True,
    )[:10]
    full = []
    for line in ranked:
        path = line.split("\t")[-1]
        full.append(git_output(["git", "diff", f"origin/{base_ref}...HEAD", "--", path]))
    return "FILES\n" + files + "\nSTAT\n" + stat + "\nLARGEST FILE DIFFS\n" + "\n".join(full)


def lens_checklists() -> str:
    sections: list[str] = []
    for path in LENS_FILES:
        if not path.is_file():
            continue
        text = path.read_text(encoding="utf-8")
        lines = [
            line
            for line in text.splitlines()
            if line.startswith("- ") or line.startswith("#") or "Review" in line or "flag" in line.lower()
        ][:80]
        sections.append(f"## {path.name}\n" + "\n".join(lines))
    return "\n\n".join(sections)


def call_anthropic(prompt: str) -> str:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("judge-review: missing ANTHROPIC_API_KEY", file=sys.stderr)
        raise SystemExit(2)
    if not increment_counter(int(os.environ.get("JUDGE_MAX_CALLS_PER_DAY", "30"))):
        print("judge-review: JUDGE_MAX_CALLS_PER_DAY exceeded", file=sys.stderr)
        raise SystemExit(2)
    payload = {
        "model": os.environ.get("JUDGE_MODEL") or DEFAULT_MODEL,
        "max_tokens": 2000,
        "temperature": 0,
        "system": (
            "You are the independent judge for an autonomous coding pipeline. "
            "The implementer is a different model. Verdict PASS only if: no gate "
            "weakening, no silent behavior change relative to the declared risk class, "
            "no forbidden action, harness/proof claims are plausible against the diff, "
            "and harness-map.json coverage never shrinks. Output exactly one line "
            "`VERDICT: PASS` or `VERDICT: FAIL - <reason>` followed by <=10 bullet findings."
        ),
        "messages": [{"role": "user", "content": prompt}],
    }
    request = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "content-type": "application/json",
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            data = json.loads(response.read().decode("utf-8"))
    except urllib.error.URLError as exc:
        print(f"judge-review: API error: {exc}", file=sys.stderr)
        raise SystemExit(2) from exc
    return "\n".join(block.get("text", "") for block in data.get("content", []) if block.get("type") == "text")


def has_pass_verdict(verdict: str) -> bool:
    verdict_lines = [
        line.strip()
        for line in verdict.splitlines()
        if line.strip().startswith("VERDICT:")
    ]
    if any(line.startswith("VERDICT: FAIL") for line in verdict_lines):
        return False
    return any(line == "VERDICT: PASS" or line.startswith("VERDICT: PASS ") for line in verdict_lines)


def main() -> int:
    payload = event_payload()
    labels = pr_labels(payload)
    if "judge-override" in labels:
        print("judge-review: judge-override present; owner-only skip.")
        return 0
    if not (labels & R1_PLUS):
        print("judge-review: R0 or unlabeled non-R1+ change; judge not required.")
        return 0
    base_ref = (
        os.environ.get("GITHUB_BASE_REF")
        or payload.get("pull_request", {}).get("base", {}).get("ref")
        or (payload.get("merge_group") or {}).get("base_ref", "")
    )
    if not base_ref:
        print("judge-review: no PR base ref; audit-only event.")
        return 0
    title = payload.get("pull_request", {}).get("title", "")
    body = payload.get("pull_request", {}).get("body", "")
    prompt = (
        f"PR title: {title}\n\nPR body:\n{body}\n\nLabels: {sorted(labels)}\n\n"
        f"Lens checklists:\n{lens_checklists()}\n\nDiff:\n{diff_text(base_ref)}"
    )
    verdict = call_anthropic(prompt)
    print(verdict)
    return 0 if has_pass_verdict(verdict) else 1


if __name__ == "__main__":
    raise SystemExit(main())
