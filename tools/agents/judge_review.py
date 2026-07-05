#!/usr/bin/env python3
"""Anthropic-backed independent PR judge for R1+ SaltMarcher changes."""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
R1_PLUS = {"risk:R1", "risk:R2", "risk:R3a", "risk:R3b", "risk:R3c"}
DEFAULT_MODEL = "claude-sonnet-4-6"
JUDGE_INSTRUCTIONS = (
    "You are the independent judge for an autonomous coding pipeline. "
    "The implementer is a different model. Verdict PASS only if: no gate "
    "weakening, no silent behavior change relative to the declared risk class, "
    "no forbidden action, harness/proof claims are plausible against the diff, "
    "and harness-map.json coverage never shrinks. Output exactly one line "
    "`VERDICT: PASS` or `VERDICT: FAIL - <reason>` followed by <=10 bullet findings."
)
LENS_FILES = [
    REPO_ROOT / "tools/quality/skills/lens-architecture/SKILL.md",
    REPO_ROOT / "tools/quality/skills/lens-code-quality/SKILL.md",
    REPO_ROOT / "tools/quality/skills/lens-security/SKILL.md",
]


class JudgeProviderError(RuntimeError):
    """Raised when one judge provider is configured but cannot return a verdict."""


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
    if api_key:
        try:
            return call_messages_api(prompt, api_key)
        except JudgeProviderError as exc:
            if os.environ.get("CLAUDE_CODE_OAUTH_TOKEN"):
                print(f"judge-review: API path unavailable, falling back to Claude Code CLI: {exc}", file=sys.stderr)
                return call_claude_code(prompt)
            print(f"judge-review: API error: {exc}", file=sys.stderr)
            raise SystemExit(2) from exc
    if os.environ.get("CLAUDE_CODE_OAUTH_TOKEN"):
        return call_claude_code(prompt)
    if not api_key:
        print("judge-review: missing ANTHROPIC_API_KEY or CLAUDE_CODE_OAUTH_TOKEN", file=sys.stderr)
        raise SystemExit(2)


def call_messages_api(prompt: str, api_key: str) -> str:
    headers = {
        "content-type": "application/json",
        "anthropic-version": "2023-06-01",
        "x-api-key": api_key,
    }
    payload = {
        "model": os.environ.get("JUDGE_MODEL") or DEFAULT_MODEL,
        "max_tokens": 2000,
        "system": JUDGE_INSTRUCTIONS,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0,
    }
    request = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            data = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise JudgeProviderError(f"HTTP {exc.code}: {body}") from exc
    except urllib.error.URLError as exc:
        raise JudgeProviderError(str(exc)) from exc
    return "\n".join(block.get("text", "") for block in data.get("content", []) if block.get("type") == "text")


def call_claude_code(prompt: str) -> str:
    if shutil.which("claude") is None:
        print("judge-review: CLAUDE_CODE_OAUTH_TOKEN is set but `claude` is not installed", file=sys.stderr)
        raise SystemExit(2)
    token = os.environ.get("CLAUDE_CODE_OAUTH_TOKEN", "")
    env = {
        key: value
        for key, value in os.environ.items()
        if key not in {"ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "CLAUDE_CODE_OAUTH_TOKEN"}
    }
    env["CLAUDE_CODE_OAUTH_TOKEN"] = token
    env["CLAUDE_CODE_ENTRYPOINT"] = "claude-code-github-action"
    result = subprocess.run(
        [
            "claude",
            "-p",
            prompt,
            "--system-prompt",
            JUDGE_INSTRUCTIONS,
            "--output-format",
            "text",
            "--model",
            os.environ.get("JUDGE_MODEL") or DEFAULT_MODEL,
            "--tools",
            "",
            "--no-session-persistence",
            "--safe-mode",
        ],
        cwd=REPO_ROOT,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        env=env,
        timeout=180,
    )
    if result.returncode != 0:
        stderr = result.stderr.replace(token, "<redacted>") if token else result.stderr
        stdout = result.stdout.replace(token, "<redacted>") if token else result.stdout
        detail = "\n".join(part for part in [stderr.strip(), stdout.strip()] if part)
        print(f"judge-review: Claude Code CLI failed with exit {result.returncode}: {detail}", file=sys.stderr)
        raise SystemExit(2)
    return result.stdout


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
