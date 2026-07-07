#!/usr/bin/env python3
"""Print a compact autonomous-operation metrics section."""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.parse
from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[3]
QUALITY_WORKFLOW = "quality-platforms.yml"
PRODUCT_ROOTS = ("src/", "test/", "shell/", "bootstrap/", "resources/")
GOVERNANCE_WORD_COUNT_ROOTS = (
    Path("AGENTS.md"),
    Path("docs/project/architecture"),
    Path("docs/project/policies"),
    Path("tools/quality/skills"),
)
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
GOVERNANCE_LINE_RE = re.compile(r"Governance-Textmasse: ([0-9]+) Woerter")
GOVERNANCE_HISTORY_RE = re.compile(r"<!-- rq1 governance-word-count-history: (\[.*?\]) -->")


@dataclass(frozen=True)
class WorkMix:
    product_merges: int
    meta_merges: int
    bot_merges: int

    @property
    def counted_merges(self) -> int:
        return self.product_merges + self.meta_merges

    @property
    def meta_ratio(self) -> float:
        if not self.counted_merges:
            return 0.0
        return self.meta_merges / self.counted_merges * 100


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
    work_mix: WorkMix
    governance_word_count: int
    previous_governance_word_count: int | None
    governance_history: list[dict[str, int | str]]
    quality_trend: dict[str, int] | None


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


def gh(args: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(["gh", *args], cwd=REPO_ROOT, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)


def gh_api_pages(path: str) -> list[Any]:
    result = gh(["api", "--paginate", "--slurp", path])
    if result.returncode != 0:
        raise IncompleteMetrics(compact_error(result.stdout))
    try:
        payload = json.loads(result.stdout or "[]")
    except json.JSONDecodeError as exc:
        raise IncompleteMetrics("GitHub API returned invalid paginated JSON") from exc
    return list(payload)


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

    return build_metrics(
        days,
        since,
        until,
        merged_prs,
        acceptance_issues,
        jobs,
        work_mix=collect_work_mix(merged_prs),
        governance_word_count=count_governance_words(),
        previous_governance_word_count=read_previous_governance_word_count(),
        governance_history=read_governance_history(),
        quality_trend=read_latest_quality_trend(),
    )


def search_issues(query: str) -> list[dict[str, Any]]:
    encoded = urllib.parse.urlencode({"q": query, "per_page": "100"})
    pages = gh_api_pages(f"search/issues?{encoded}")
    items: list[dict[str, Any]] = []
    for page in pages:
        if isinstance(page, dict):
            items.extend(list(page.get("items") or []))
    return items


def workflow_runs_since(since: datetime) -> list[dict[str, Any]]:
    created = since.strftime("%Y-%m-%dT%H:%M:%SZ")
    encoded = urllib.parse.urlencode({"branch": "main", "created": f">={created}", "per_page": "100"})
    payload = gh_api(f"repos/:owner/:repo/actions/workflows/{QUALITY_WORKFLOW}/runs?{encoded}")
    return list(payload.get("workflow_runs") or [])


def workflow_jobs(run_id: str) -> list[dict[str, Any]]:
    payload = gh_api(f"repos/:owner/:repo/actions/runs/{run_id}/jobs?per_page=100")
    return list(payload.get("jobs") or [])


def collect_work_mix(merged_prs: list[dict[str, Any]]) -> WorkMix:
    product = 0
    meta = 0
    bot = 0
    for pr in merged_prs:
        login = str(((pr.get("user") or {}).get("login")) or "")
        if login.endswith("[bot]"):
            bot += 1
            continue
        files = changed_files_for_pr(int(pr.get("number") or 0))
        if classify_pr_files(files) == "product":
            product += 1
        else:
            meta += 1
    return WorkMix(product, meta, bot)


def changed_files_for_pr(number: int) -> list[str]:
    if not number:
        return []
    pages = gh_api_pages(f"repos/:owner/:repo/pulls/{number}/files?per_page=100")
    files: list[str] = []
    for page in pages:
        if isinstance(page, list):
            files.extend(str(item.get("filename") or "") for item in page)
    return files


def classify_pr_files(files: list[str]) -> str:
    return "product" if any(path.startswith(PRODUCT_ROOTS) for path in files) else "meta"


def count_governance_words() -> int:
    total = 0
    for root in GOVERNANCE_WORD_COUNT_ROOTS:
        path = REPO_ROOT / root
        if path.is_file() and path.suffix == ".md":
            total += word_count(path.read_text(encoding="utf-8"))
        elif path.is_dir():
            for markdown in path.rglob("*.md"):
                total += word_count(markdown.read_text(encoding="utf-8"))
    return total


def word_count(text: str) -> int:
    return len(re.findall(r"[A-Za-z0-9_ÄÖÜäöüß]+", text))


def read_previous_governance_word_count() -> int | None:
    history = read_governance_history()
    weekly = governance_week_reference(history, datetime.now(timezone.utc))
    if weekly is not None:
        return weekly
    result = gh(["issue", "list", "--state", "open", "--search", "SaltMarcher Statusbericht", "--json", "body,title"])
    if result.returncode != 0:
        return None
    try:
        issues = json.loads(result.stdout or "[]")
    except json.JSONDecodeError:
        return None
    for issue in issues:
        if issue.get("title") != "SaltMarcher Statusbericht":
            continue
        body = str(issue.get("body") or "")
        match = GOVERNANCE_LINE_RE.search(body)
        if match:
            return int(match.group(1))
    return None


def read_governance_history() -> list[dict[str, int | str]]:
    result = gh(["issue", "list", "--state", "open", "--search", "SaltMarcher Statusbericht", "--json", "body,title"])
    if result.returncode != 0:
        return []
    try:
        issues = json.loads(result.stdout or "[]")
    except json.JSONDecodeError:
        return []
    for issue in issues:
        if issue.get("title") != "SaltMarcher Statusbericht":
            continue
        match = GOVERNANCE_HISTORY_RE.search(str(issue.get("body") or ""))
        if not match:
            return []
        try:
            history = json.loads(match.group(1))
        except json.JSONDecodeError:
            return []
        return [item for item in history if isinstance(item, dict)]
    return []


def governance_week_reference(history: list[dict[str, int | str]], now: datetime) -> int | None:
    cutoff = now.date() - timedelta(days=7)
    dated: list[tuple[str, int]] = []
    for item in history:
        date = str(item.get("date") or "")
        if date <= cutoff.isoformat():
            dated.append((date, int(item.get("words") or 0)))
    if not dated:
        return None
    return sorted(dated)[-1][1]


def read_latest_quality_trend() -> dict[str, int] | None:
    run_id = latest_main_quality_run_id()
    if not run_id:
        return None
    temp = Path(tempfile.mkdtemp(prefix="saltmarcher-quality-trend-"))
    try:
        result = gh(["run", "download", run_id, "--name", "quality-trend", "--dir", str(temp)])
        if result.returncode != 0:
            return None
        candidates = list(temp.rglob("delta.json"))
        if not candidates:
            return None
        payload = json.loads(candidates[0].read_text(encoding="utf-8"))
        return {
            "dup_lines": int(payload.get("dup_lines_head", 0)),
            "dup_delta": int(payload.get("dup_delta", 0)),
            "smells": int(payload.get("smell_head", 0)),
            "smell_delta": int(payload.get("smell_delta", 0)),
        }
    except (json.JSONDecodeError, ValueError):
        return None
    finally:
        shutil.rmtree(temp, ignore_errors=True)


def latest_main_quality_run_id() -> str | None:
    result = gh([
        "run",
        "list",
        "--workflow",
        QUALITY_WORKFLOW,
        "--branch",
        "main",
        "--json",
        "databaseId,status,conclusion",
        "--limit",
        "20",
    ])
    if result.returncode != 0:
        return None
    try:
        runs = json.loads(result.stdout or "[]")
    except json.JSONDecodeError:
        return None
    for run in runs:
        if run.get("status") == "completed" and run.get("conclusion") == "success":
            return str(run.get("databaseId") or "")
    return None


def build_metrics(
    days: int,
    since: datetime,
    until: datetime,
    merged_prs: list[dict[str, Any]],
    acceptance_issues: list[dict[str, Any]],
    jobs: list[dict[str, Any]],
    *,
    work_mix: WorkMix | None = None,
    governance_word_count: int = 0,
    previous_governance_word_count: int | None = None,
    governance_history: list[dict[str, int | str]] | None = None,
    quality_trend: dict[str, int] | None = None,
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
        work_mix=work_mix or WorkMix(0, 0, 0),
        governance_word_count=governance_word_count,
        previous_governance_word_count=previous_governance_word_count,
        governance_history=governance_history or [],
        quality_trend=quality_trend,
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
            f"- Meta-Anteil (14 Tage): {metrics.work_mix.meta_ratio:.1f}% (Deckel 35%) "
            f"[{metrics.work_mix.meta_merges}/{metrics.work_mix.counted_merges}, Bots ausgeschlossen: {metrics.work_mix.bot_merges}].",
            f"- Governance-Textmasse: {metrics.governance_word_count} Woerter ({governance_trend(metrics)}).",
            f"- {quality_trend_line(metrics.quality_trend)}",
            f"- Rote Required-Check-Laeufe: {red_text}.",
            f"- Judge-FAILs: {metrics.judge_failures}.",
            f"- Reverts: {len(metrics.reverts)}" + (f" ({'; '.join(metrics.reverts[:5])})" if metrics.reverts else "."),
            f"- Offene Abnahmen: {len(metrics.open_acceptances)}" + format_acceptance_tail(metrics.open_acceptances),
            governance_history_marker(metrics),
        ]
    )
    return "\n".join(lines)


def governance_trend(metrics: Metrics) -> str:
    previous = metrics.previous_governance_word_count
    if previous is None:
        return "Trend: unbekannt"
    delta = metrics.governance_word_count - previous
    sign = "+" if delta >= 0 else ""
    return f"Trend vs. Vorwoche: {sign}{delta}"


def governance_history_marker(metrics: Metrics) -> str:
    today = metrics.until.date().isoformat()
    by_date: dict[str, int] = {}
    for item in metrics.governance_history:
        date = str(item.get("date") or "")
        if date:
            by_date[date] = int(item.get("words") or 0)
    by_date[today] = metrics.governance_word_count
    cutoff = metrics.until.date() - timedelta(days=28)
    history = [
        {"date": date, "words": words}
        for date, words in sorted(by_date.items())
        if date >= cutoff.isoformat()
    ]
    return f"<!-- rq1 governance-word-count-history: {json.dumps(history, separators=(',', ':'))} -->"


def quality_trend_line(quality_trend: dict[str, int] | None) -> str:
    if not quality_trend:
        return "Duplikat-Zeilen (Produktion): Metriken heute unvollstaendig"
    dup_delta = quality_trend.get("dup_delta", 0)
    smell_delta = quality_trend.get("smell_delta", 0)
    dup_sign = "+" if dup_delta >= 0 else ""
    smell_sign = "+" if smell_delta >= 0 else ""
    return (
        f"Duplikat-Zeilen (Produktion): {quality_trend.get('dup_lines', 0)} "
        f"(Delta 7 Tage: {dup_sign}{dup_delta}) | "
        f"Smells: {quality_trend.get('smells', 0)} ({smell_sign}{smell_delta})"
    )


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
    assert classify_pr_files(["src/foo/App.java"]) == "product"
    assert classify_pr_files(["docs/project/architecture/night-shift.md"]) == "meta"
    assert classify_pr_files(["docs/project/architecture/night-shift.md", "test/src/FooHarness.java"]) == "product"
    original_gh = globals()["gh"]

    paginated_calls: list[list[str]] = []

    def fake_paginated_gh(args: list[str]) -> subprocess.CompletedProcess[str]:
        assert "--paginate" in args
        assert "--slurp" in args
        paginated_calls.append(args)
        joined = " ".join(args)
        if "search/issues" in joined:
            payload = [{"items": [{"number": 1}]}, {"items": [{"number": 2}]}]
        elif "pulls/99/files" in joined:
            payload = [[{"filename": "docs/a.md"}], [{"filename": "src/LateProduct.java"}]]
        else:
            payload = []
        return subprocess.CompletedProcess(["gh", *args], 0, json.dumps(payload), "")

    globals()["gh"] = fake_paginated_gh
    try:
        assert [item["number"] for item in search_issues("repo:x/y is:pr")] == [1, 2]
        assert changed_files_for_pr(99) == ["docs/a.md", "src/LateProduct.java"]
        assert any("search/issues" in " ".join(args) for args in paginated_calls)
        assert any("pulls/99/files" in " ".join(args) for args in paginated_calls)
    finally:
        globals()["gh"] = original_gh

    original_changed_files_for_pr = globals()["changed_files_for_pr"]
    globals()["changed_files_for_pr"] = lambda number: {
        1: ["src/Foo.java"],
        2: ["docs/project/architecture/night-shift.md"],
        3: ["src/Bar.java"],
    }.get(number, [])
    try:
        mix = collect_work_mix([
            {"number": 1, "user": {"login": "human"}},
            {"number": 2, "user": {"login": "human"}},
            {"number": 3, "user": {"login": "dependabot[bot]"}},
        ])
        assert mix.product_merges == 1
        assert mix.meta_merges == 1
        assert mix.bot_merges == 1
    finally:
        globals()["changed_files_for_pr"] = original_changed_files_for_pr
    history = [{"date": "2026-06-28", "words": 88}, {"date": "2026-07-05", "words": 99}]
    assert governance_week_reference(history, now) == 88
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
        work_mix=WorkMix(product_merges=1, meta_merges=1, bot_merges=1),
        governance_word_count=120,
        previous_governance_word_count=100,
        governance_history=history,
        quality_trend={"dup_lines": 10, "dup_delta": 0, "smells": 4, "smell_delta": -1},
    )
    text = render_markdown(metrics)
    assert "Merges/Tag: 0.14" in text
    assert "Meta-Anteil (14 Tage): 50.0% (Deckel 35%)" in text
    assert "Governance-Textmasse: 120 Woerter (Trend vs. Vorwoche: +20)" in text
    assert "rq1 governance-word-count-history" in text
    assert "Duplikat-Zeilen (Produktion): 10 (Delta 7 Tage: +0) | Smells: 4 (-1)" in text
    assert "Rote Required-Check-Laeufe: 1/2 (50.0%)" in text
    assert "Judge-FAILs: 1" in text
    assert "Reverts: 1 (#102 Revert broken gate)" in text
    assert "Offene Abnahmen: 1 (#77 5d)" in text
    assert INCOMPLETE_LINE in render_incomplete("rate limit")
    import update_status_issue

    original_collect = update_status_issue.nightshift_metrics.collect_metrics
    original_render = update_status_issue.nightshift_metrics.render_markdown
    update_status_issue.nightshift_metrics.collect_metrics = lambda _days: metrics
    update_status_issue.nightshift_metrics.render_markdown = lambda _metrics, title=False: render_markdown(metrics, title=title)
    try:
        integrated = "\n".join(update_status_issue.autodev_metrics_status())
        assert "Meta-Anteil (14 Tage): 50.0% (Deckel 35%)" in integrated
        assert "rq1 governance-word-count-history" in integrated
    finally:
        update_status_issue.nightshift_metrics.collect_metrics = original_collect
        update_status_issue.nightshift_metrics.render_markdown = original_render
    print("nightshift_metrics selftest PASS")
    return 0


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--days", type=int, default=14)
    parser.add_argument("--no-title", action="store_true")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args(argv)
    if args.self_test:
        return run_selftest()
    try:
        print(render_markdown(collect_metrics(args.days), title=not args.no_title))
    except IncompleteMetrics as exc:
        print(render_incomplete(str(exc), title=not args.no_title))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
