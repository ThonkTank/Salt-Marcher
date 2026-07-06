#!/usr/bin/env python3
"""Print a compact 14-day autonomous-operation metrics section."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import urllib.parse
from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[3]
QUALITY_WORKFLOW = "quality-platforms.yml"
REQUIRED_CHECKS = {
    "production-handoff",
    "warden-freeze",
    "behavior-gate",
    "judge-review",
}
RED_CONCLUSIONS = {
    "action_required",
    "cancelled",
    "failure",
    "startup_failure",
    "timed_out",
}
INCOMPLETE_LINE = "Metriken heute unvollstaendig"


@dataclass(frozen=True)
class Metrics:
    days: int
    since: datetime
    until: datetime
    merges_by_day: Counter[str]
    required_check_total: int
    required_check_red: int
    judge_failures: int
    reverts: list[str]
    open_acceptances: list[tuple[int, str, int]]


class IncompleteMetrics(RuntimeError):
    pass


def gh_api(path: str) -> Any:
    result = subprocess.run(
        ["gh", "api", path],
        cwd=REPO_ROOT,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )
    if result.returncode != 0:
        raise IncompleteMetrics(compact_error(result.stdout))
    try:
        return json.loads(result.stdout or "{}")
    except json.JSONDecodeError as exc:
        raise IncompleteMetrics("GitHub API returned invalid JSON") from exc


def compact_error(raw: str) -> str:
    text = raw.strip()
    if not text:
        return "empty GitHub API response"
    try:
        payload = json.loads(text)
    except json.JSONDecodeError:
        return text.splitlines()[-1][:180]
    message = str(payload.get("message") or "unknown GitHub API error")
    status = payload.get("status")
    if status:
        return f"{message} (HTTP {status})"
    return message


def repo_qualifier() -> str:
    payload = gh_api("repos/:owner/:repo")
    full_name = payload.get("full_name")
    if not full_name:
        raise IncompleteMetrics("GitHub repository name was not returned")
    return str(full_name)


def collect_metrics(days: int, now: datetime | None = None) -> Metrics:
    until = now or datetime.now(timezone.utc)
    since = until - timedelta(days=days)
    repo = repo_qualifier()
    merged_prs = search_issues(
        f"repo:{repo} is:pr is:merged base:main merged:>={since.date().isoformat()}"
    )
    acceptance_issues = search_issues(f"repo:{repo} is:issue is:open label:abnahme-offen")
    workflow_runs = workflow_runs_since(since)

    jobs = []
    for run in workflow_runs:
        run_id = run.get("id")
        if run_id:
            jobs.extend(workflow_jobs(str(run_id)))

    return build_metrics(days, since, until, merged_prs, acceptance_issues, jobs)


def search_issues(query: str) -> list[dict[str, Any]]:
    encoded = urllib.parse.urlencode({"q": query, "per_page": "100"})
    payload = gh_api(f"search/issues?{encoded}")
    return list(payload.get("items") or [])


def workflow_runs_since(since: datetime) -> list[dict[str, Any]]:
    created = since.strftime("%Y-%m-%dT%H:%M:%SZ")
    encoded = urllib.parse.urlencode(
        {
            "branch": "main",
            "created": f">={created}",
            "per_page": "100",
        }
    )
    payload = gh_api(f"repos/:owner/:repo/actions/workflows/{QUALITY_WORKFLOW}/runs?{encoded}")
    return list(payload.get("workflow_runs") or [])


def workflow_jobs(run_id: str) -> list[dict[str, Any]]:
    payload = gh_api(f"repos/:owner/:repo/actions/runs/{run_id}/jobs?per_page=100")
    return list(payload.get("jobs") or [])


def build_metrics(
    days: int,
    since: datetime,
    until: datetime,
    merged_prs: list[dict[str, Any]],
    acceptance_issues: list[dict[str, Any]],
    jobs: list[dict[str, Any]],
) -> Metrics:
    merges_by_day: Counter[str] = Counter()
    reverts: list[str] = []
    for pr in merged_prs:
        merged_at = parse_github_time(pr.get("closed_at"))
        if merged_at:
            merges_by_day[merged_at.date().isoformat()] += 1
        title = str(pr.get("title") or "")
        if "revert" in title.lower():
            reverts.append(format_item(pr))

    required_jobs = [job for job in jobs if job.get("name") in REQUIRED_CHECKS]
    red_jobs = [job for job in required_jobs if str(job.get("conclusion") or "").lower() in RED_CONCLUSIONS]
    judge_failures = sum(
        1
        for job in required_jobs
        if job.get("name") == "judge-review" and str(job.get("conclusion") or "").lower() in RED_CONCLUSIONS
    )
    open_acceptances = []
    for issue in acceptance_issues:
        created_at = parse_github_time(issue.get("created_at"))
        age = (until.date() - created_at.date()).days if created_at else 0
        open_acceptances.append((int(issue.get("number") or 0), str(issue.get("title") or "<untitled>"), age))
    open_acceptances.sort(key=lambda item: (-item[2], item[0]))

    return Metrics(
        days=days,
        since=since,
        until=until,
        merges_by_day=merges_by_day,
        required_check_total=len(required_jobs),
        required_check_red=len(red_jobs),
        judge_failures=judge_failures,
        reverts=sorted(reverts),
        open_acceptances=open_acceptances,
    )


def parse_github_time(value: object) -> datetime | None:
    if not isinstance(value, str) or not value:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def format_item(item: dict[str, Any]) -> str:
    number = item.get("number", "?")
    title = str(item.get("title") or "<untitled>")
    return f"#{number} {title}"


def render_markdown(metrics: Metrics, *, title: bool = True) -> str:
    lines: list[str] = []
    if title:
        lines.extend(["## Autodev-Metriken (14 Tage)", ""])
    start = metrics.since.date().isoformat()
    end = metrics.until.date().isoformat()
    average = sum(metrics.merges_by_day.values()) / metrics.days if metrics.days else 0.0
    if metrics.required_check_total:
        red_share = metrics.required_check_red / metrics.required_check_total * 100
        red_text = f"{metrics.required_check_red}/{metrics.required_check_total} ({red_share:.1f}%)"
    else:
        red_text = "0/0 (keine Laeufe gefunden)"

    lines.extend(
        [
            f"- Zeitraum: {start} bis {end}.",
            f"- Merges/Tag: {average:.2f} im Schnitt ({sum(metrics.merges_by_day.values())} Merges gesamt).",
            f"- Rote Required-Check-Laeufe: {red_text}.",
            f"- Judge-FAILs: {metrics.judge_failures}.",
            f"- Reverts: {len(metrics.reverts)}" + (f" ({'; '.join(metrics.reverts[:5])})" if metrics.reverts else "."),
            f"- Offene Abnahmen: {len(metrics.open_acceptances)}" + format_acceptance_tail(metrics.open_acceptances),
        ]
    )
    return "\n".join(lines)


def format_acceptance_tail(items: list[tuple[int, str, int]]) -> str:
    if not items:
        return "."
    rendered = [f"#{number} {age}d" for number, _title, age in items[:5]]
    return f" ({', '.join(rendered)})."


def render_incomplete(message: str, *, title: bool = True) -> str:
    lines = []
    if title:
        lines.extend(["## Autodev-Metriken (14 Tage)", ""])
    lines.append(f"- {INCOMPLETE_LINE}: {message}.")
    return "\n".join(lines)


def run_selftest() -> int:
    now = datetime(2026, 7, 6, 12, 0, tzinfo=timezone.utc)
    metrics = build_metrics(
        14,
        now - timedelta(days=14),
        now,
        [
            {"number": 101, "title": "Feature slice", "closed_at": "2026-07-05T10:00:00Z"},
            {"number": 102, "title": "Revert broken gate", "closed_at": "2026-07-05T11:00:00Z"},
        ],
        [
            {"number": 77, "title": "Abnahme offen", "created_at": "2026-07-01T09:00:00Z"},
        ],
        [
            {"name": "production-handoff", "conclusion": "success"},
            {"name": "judge-review", "conclusion": "failure"},
            {"name": "codescene", "conclusion": "failure"},
        ],
    )
    text = render_markdown(metrics)
    assert "Merges/Tag: 0.14" in text
    assert "Rote Required-Check-Laeufe: 1/2 (50.0%)" in text
    assert "Judge-FAILs: 1" in text
    assert "Reverts: 1 (#102 Revert broken gate)" in text
    assert "Offene Abnahmen: 1 (#77 5d)" in text
    assert INCOMPLETE_LINE in render_incomplete("rate limit")
    print("nightshift_metrics selftest PASS")
    return 0


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--days", type=int, default=14)
    parser.add_argument("--no-title", action="store_true")
    parser.add_argument("--selftest", action="store_true")
    return parser.parse_args(argv)


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    if args.selftest:
        return run_selftest()
    try:
        metrics = collect_metrics(args.days)
    except IncompleteMetrics as exc:
        print(render_incomplete(str(exc), title=not args.no_title))
        return 0
    print(render_markdown(metrics, title=not args.no_title))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
