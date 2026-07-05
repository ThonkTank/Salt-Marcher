#!/usr/bin/env python3
"""Create or replace the German SaltMarcher status issue body."""

from __future__ import annotations

import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]
TITLE = "SaltMarcher Statusbericht"
REQUIRED_CHECKS = [
    "production-handoff",
    "warden-freeze",
    "behavior-gate",
    "judge-review",
]
ISSUE_TEMPLATE_FILES = [
    "bugreport.yml",
    "featurewunsch.yml",
    "ux-problem.yml",
]
TARGET_BRANCH = "codex/target-operating-model"
SIGNOFF_PHRASE = "passt"


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


def open_items(label: str, *, exclude_status_issue: bool = False) -> list[str]:
    result = gh(["issue", "list", "--state", "open", "--label", label, "--json", "number,title"])
    if result.returncode != 0:
        return [f"`gh issue list --label {label}` nicht verfuegbar"]
    rows = []
    for item in json.loads(result.stdout or "[]"):
        if exclude_status_issue and item.get("title") == TITLE:
            continue
        rows.append(f"- #{item['number']} {item['title']}")
    return rows


def secret_status() -> list[str]:
    result = gh(["secret", "list", "--json", "name"])
    if result.returncode != 0:
        return ["- GitHub-Secrets konnten nicht gelesen werden."]
    names = {item.get("name") for item in json.loads(result.stdout or "[]")}
    if "ANTHROPIC_API_KEY" in names:
        return ["- `ANTHROPIC_API_KEY` ist gesetzt."]
    return ["- `ANTHROPIC_API_KEY` fehlt; `judge-review` blockiert R1+ PRs fail-closed."]


def rollout_pr_number() -> str | None:
    result = gh(["pr", "list", "--state", "open", "--label", "risk:R3c", "--json", "number,headRefName", "--limit", "20"])
    if result.returncode != 0:
        return None
    for pr in json.loads(result.stdout or "[]"):
        if pr.get("headRefName") == TARGET_BRANCH:
            return str(pr.get("number"))
    return None


def has_signoff_comment(text: str) -> bool:
    return any(line.strip().lower() == SIGNOFF_PHRASE for line in text.splitlines())


def resource_policy_signoff_status() -> list[str]:
    number = rollout_pr_number()
    if not number:
        return ["- Resource-Policy-Signoff: Target-Operating-Model-PR nicht gefunden."]
    result = gh(["pr", "view", number, "--json", "comments,url"])
    if result.returncode != 0:
        return [f"- Resource-Policy-Signoff: Kommentare fuer PR #{number} nicht lesbar."]
    payload = json.loads(result.stdout or "{}")
    comments = payload.get("comments", [])
    if any(has_signoff_comment(comment.get("body", "")) for comment in comments):
        return [f"- Resource-Policy-Signoff: `passt` liegt auf PR #{number} vor."]
    url = payload.get("url", f"PR #{number}")
    return [
        f"- Resource-Policy-Signoff fehlt: kommentiere auf PR #{number} exakt `passt`.",
        f"- PR: {url}",
    ]


def github_directory_names(path: str, ref: str) -> set[str] | None:
    result = gh(["api", f"repos/:owner/:repo/contents/{path}?ref={ref}"])
    if result.returncode != 0:
        return None
    payload = json.loads(result.stdout or "[]")
    if not isinstance(payload, list):
        return None
    return {item.get("name", "") for item in payload}


def issue_template_status() -> list[str]:
    required = set(ISSUE_TEMPLATE_FILES)
    main_names = github_directory_names(".github/ISSUE_TEMPLATE", "main")
    if main_names is None:
        branch_names = github_directory_names(".github/ISSUE_TEMPLATE", TARGET_BRANCH) or set()
        if required.issubset(branch_names):
            return [
                "- Issue-Templates: auf dem PR-Branch vorhanden, aber noch nicht auf `main`; UI-Rendercheck erst nach Merge moeglich.",
            ]
        return ["- Issue-Templates: auf `main` nicht lesbar; PR-Branch-Abgleich ebenfalls unvollstaendig."]
    missing = sorted(required - main_names)
    if missing:
        return [f"- Issue-Templates: auf `main` fehlen {', '.join(f'`{name}`' for name in missing)}."]
    return ["- Issue-Templates: Dateien liegen auf `main`; GitHub-New-Issue-UI noch einmal manuell oeffnen."]


def owner_action_status() -> list[str]:
    return [
        *resource_policy_signoff_status(),
        *issue_template_status(),
    ]


def required_check_status() -> list[str]:
    number = rollout_pr_number()
    if not number:
        return ["- Kein offener Target-Operating-Model-PR mit `risk:R3c` gefunden."]
    result = gh(["pr", "view", number, "--json", "statusCheckRollup,url"])
    if result.returncode != 0:
        return [f"- PR #{number}: Check-Status nicht verfuegbar."]
    payload = json.loads(result.stdout or "{}")
    checks = {}
    for check in payload.get("statusCheckRollup", []):
        name = check.get("name")
        if name in REQUIRED_CHECKS:
            conclusion = check.get("conclusion") or check.get("status") or "UNKNOWN"
            checks[name] = conclusion.lower()
    lines = [f"- PR #{number}: {payload.get('url', '')}".rstrip()]
    for name in REQUIRED_CHECKS:
        lines.append(f"- `{name}`: `{checks.get(name, 'missing')}`")
    return lines


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
    feedback = open_items("owner-feedback", exclude_status_issue=True)
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
        *secret_status(),
        "",
        "## Wartet auf Owner-Aktion",
        "",
        *owner_action_status(),
        "",
        "## Owner-Regeln",
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
        *required_check_status(),
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
