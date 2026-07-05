#!/usr/bin/env python3
"""Promote main to the next stable tag when acceptance blockers are clear."""

from __future__ import annotations

import re
import json
import subprocess
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]


def run(args: list[str], check: bool = False) -> subprocess.CompletedProcess[str]:
    return subprocess.run(args, cwd=REPO_ROOT, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, check=check)


def latest_tag() -> str | None:
    result = run(["git", "tag", "--list", "v*", "--sort=-v:refname"])
    tags = [line.strip() for line in result.stdout.splitlines() if line.strip()]
    return tags[0] if tags else None


def tag_date(tag: str | None) -> str:
    if not tag:
        return "1970-01-01T00:00:00Z"
    result = run(["git", "log", "-1", "--format=%cI", tag])
    return result.stdout.strip() or "1970-01-01T00:00:00Z"


def next_tag(previous: str | None, minor: bool) -> str:
    if not previous:
        return "v0.2.0"
    match = re.fullmatch(r"v(\d+)\.(\d+)\.(\d+)", previous)
    if not match:
        return "v0.2.0"
    major, current_minor, patch = map(int, match.groups())
    if minor:
        return f"v{major}.{current_minor + 1}.0"
    return f"v{major}.{current_minor}.{patch + 1}"


def merged_prs_since(tag: str | None) -> list[dict]:
    since = tag_date(tag)
    result = run([
        "gh",
        "pr",
        "list",
        "--state",
        "merged",
        "--base",
        "main",
        "--search",
        f"merged:>={since}",
        "--json",
        "number,title,labels,body",
        "--limit",
        "100",
    ])
    if result.returncode != 0:
        raise RuntimeError("Could not query merged PRs: " + result.stdout.strip())
    return json.loads(result.stdout or "[]")


def label_names(pr: dict) -> set[str]:
    return {label.get("name", "") for label in pr.get("labels", [])}


def has_open_blocker(prs: list[dict]) -> bool:
    acceptance = run(["gh", "issue", "list", "--state", "open", "--label", "abnahme-offen", "--json", "number"])
    if acceptance.returncode == 0 and acceptance.stdout.strip() not in ("[]", ""):
        print("promotion blocked: offene Abnahme")
        return True
    for pr in prs:
        labels = label_names(pr)
        if "risk:R2" in labels and "abnahme-ok" not in labels:
            print(f"promotion blocked: PR #{pr['number']} is risk:R2 without abnahme-ok")
            return True
        if "risk:R3b" in labels and "owner-question-open" in labels:
            print(f"promotion blocked: PR #{pr['number']} has an open outside-policy owner question")
            return True
    return False


def release_note(pr: dict) -> str:
    body = pr.get("body") or ""
    marker = "German release note:"
    if marker in body:
        note = body.split(marker, 1)[1].strip().splitlines()[0].strip()
        if note:
            return note
    labels = label_names(pr)
    if "risk:R2" in labels:
        return f"#{pr['number']} {pr['title']}"
    return "Interne Verbesserungen"


def release_notes(prs: list[dict]) -> str:
    if not prs:
        return "Interne Verbesserungen."
    notes = []
    for pr in prs:
        notes.append(f"- {release_note(pr)}")
    return "\n".join(notes)


def main() -> int:
    previous = latest_tag()
    prs = merged_prs_since(previous)
    if has_open_blocker(prs):
        return 0
    result = run(["gh", "run", "list", "--branch", "main", "--workflow", "quality-platforms", "--limit", "1", "--json", "conclusion"])
    if result.returncode != 0 or '"success"' not in result.stdout:
        print("promotion blocked: latest main CI is not confirmed green")
        return 0
    tag = next_tag(previous, minor=any("risk:R2" in label_names(pr) for pr in prs))
    notes = release_notes(prs)
    run(["git", "tag", "-a", tag, "-m", f"SaltMarcher {tag}\n\n{notes}"], check=True)
    run(["git", "push", "origin", tag], check=True)
    print(f"promoted {tag}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
