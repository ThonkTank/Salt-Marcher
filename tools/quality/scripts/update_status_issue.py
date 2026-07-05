#!/usr/bin/env python3
"""Create or replace the German SaltMarcher status issue body."""

from __future__ import annotations

import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]
TITLE = "SaltMarcher Statusbericht"


def gh(args: list[str], check: bool = False) -> subprocess.CompletedProcess[str]:
    return subprocess.run(["gh", *args], cwd=REPO_ROOT, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, check=check)


def issue_number() -> str | None:
    result = gh(["issue", "list", "--state", "open", "--search", TITLE, "--json", "number,title"])
    if result.returncode != 0:
        return None
    for issue in json.loads(result.stdout or "[]"):
        if issue.get("title") == TITLE:
            return str(issue.get("number"))
    return None


def open_items(label: str) -> list[str]:
    result = gh(["issue", "list", "--state", "open", "--label", label, "--json", "number,title"])
    if result.returncode != 0:
        return [f"`gh issue list --label {label}` nicht verfuegbar"]
    return [f"- #{item['number']} {item['title']}" for item in json.loads(result.stdout or "[]")]


def latest_tag() -> str:
    result = subprocess.run(
        ["git", "tag", "--list", "v*", "--sort=-v:refname"],
        cwd=REPO_ROOT,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
    )
    return next((line.strip() for line in result.stdout.splitlines() if line.strip()), "noch kein stable-Tag")


def merged_last_day() -> list[str]:
    result = gh([
        "pr",
        "list",
        "--state",
        "merged",
        "--base",
        "main",
        "--search",
        "merged:>=@today-1d",
        "--json",
        "number,title,labels",
        "--limit",
        "20",
    ])
    if result.returncode != 0:
        return ["- Merge-Liste nicht verfuegbar."]
    rows = []
    for pr in json.loads(result.stdout or "[]"):
        risks = [label.get("name") for label in pr.get("labels", []) if label.get("name", "").startswith("risk:")]
        rows.append(f"- #{pr['number']} {pr['title']} ({', '.join(risks) or 'ohne Risikolabel'})")
    return rows


def body() -> str:
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    acceptance = open_items("abnahme-offen")
    feedback = open_items("owner-feedback")
    merged = merged_last_day()
    return "\n".join([
        "# SaltMarcher Statusbericht",
        "",
        f"Aktualisiert: {now}",
        "",
        "## Aktuelle stable-Version",
        "",
        latest_tag(),
        "",
        "## Letzte Nacht gemerged",
        "",
        *(merged or ["- Keine gemergten PRs gefunden."]),
        "",
        "## Wartet auf deine Abnahme",
        "",
        *(acceptance or ["- Keine offene Abnahme."]),
        "",
        "## Wartet auf deinen Schluessel",
        "",
        "- R3c: `gate-change-approved` nur setzen, wenn der Statusbericht darum bittet.",
        "- R3b ausserhalb der Resource-Policy: Empfehlung und Default stehen in der Frage.",
        "- `Entscheid du` akzeptiert die Empfehlung mit maximalen Sicherungen.",
        "",
        "## Durchgefuehrte Datenmigrationen",
        "",
        "Keine Migration im letzten Lauf gemeldet.",
        "",
        "## Blocker und Owner-Feedback",
        "",
        *(feedback or ["- Keine offenen Owner-Feedback-Issues."]),
        "",
        "## CI-Zustand",
        "",
        "Branch-Protection-Readback und Required-Checks muessen `Qualified` melden.",
    ])


def main() -> int:
    text = body()
    number = issue_number()
    if number:
        gh(["issue", "edit", number, "--body", text], check=True)
        print(f"updated issue #{number}")
    else:
        gh(["issue", "create", "--title", TITLE, "--body", text, "--label", "owner-feedback"], check=True)
        print("created status issue")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
