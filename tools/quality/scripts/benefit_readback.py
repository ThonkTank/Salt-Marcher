#!/usr/bin/env python3
"""Read back delayed benefits for autonomous PRs."""

from __future__ import annotations

import argparse
import fnmatch
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[3]
FEEDBACK_DIR = Path(os.environ.get("BENEFIT_READBACK_FEEDBACK_DIR", REPO_ROOT / ".codex/autodev/feedback"))
SUPPORTED_METRIC_RE = r"(?:dup_lines|smell_count|class_loc:[^;]+|file_count:[^;]+|word_count:[^;]+)"
BENEFIT_RE = re.compile(
    rf"^Benefit:\s+(?:metric=(?P<metric>{SUPPORTED_METRIC_RE});\s+direction=(?P<direction>down|up);\s+scope=(?P<scope>[^\n;]+)|qualitative=(?P<qualitative>[^\n]+))$",
    re.MULTILINE,
)
BENEFIT_EVIDENCE_RE = re.compile(r"^Benefit evidence:\s+(?P<evidence>[^<>\n][^\n]{8,})$", re.MULTILINE)
READBACK_LINE_RE = re.compile(r"RQ4 readback: PR #(?P<number>\d+) benefit (?P<verdict>\w+)")
QUALITY_REPORT_CACHE: dict[str, dict[str, int]] = {}


@dataclass(frozen=True)
class Benefit:
    metric: str | None
    direction: str | None
    scope: str | None
    qualitative: str | None


def gh(args: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(["gh", *args], cwd=REPO_ROOT, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)


def run(cmd: list[str], cwd: Path, *, check: bool = True) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(cmd, cwd=cwd, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    if check and result.returncode != 0:
        raise RuntimeError(f"{' '.join(cmd)} failed in {cwd}:\n{result.stdout}")
    return result


def parse_benefit(body: str) -> Benefit | None:
    match = BENEFIT_RE.search(body or "")
    if not match:
        return None
    return Benefit(
        metric=match.group("metric"),
        direction=match.group("direction"),
        scope=match.group("scope"),
        qualitative=match.group("qualitative"),
    )


def merged_prs(now: datetime) -> list[dict[str, Any]]:
    since = (now - timedelta(days=14)).date().isoformat()
    until = (now - timedelta(days=7)).date().isoformat()
    result = gh([
        "pr",
        "list",
        "--state",
        "merged",
        "--search",
        f"merged:{since}..{until}",
        "--json",
        "number,title,body,labels,mergeCommit,mergedAt",
        "--limit",
        "100",
    ])
    if result.returncode != 0:
        raise RuntimeError(result.stdout)
    return list(json.loads(result.stdout or "[]"))


def readback_history() -> dict[int, list[str]]:
    history: dict[int, list[str]] = {}
    for path in (REPO_ROOT / "docs/project/journal").glob("*.md"):
        for match in READBACK_LINE_RE.finditer(path.read_text(encoding="utf-8")):
            history.setdefault(int(match.group("number")), []).append(match.group("verdict"))
    for path in FEEDBACK_DIR.glob("benefit-readback-*.jsonl"):
        for line in path.read_text(encoding="utf-8").splitlines():
            try:
                payload = json.loads(line)
            except json.JSONDecodeError:
                continue
            number = payload.get("pr_number")
            verdict = payload.get("delayed_benefit")
            if isinstance(number, int) and isinstance(verdict, str):
                history.setdefault(number, []).append(verdict)
    return history


def task_class(labels: list[dict[str, Any]]) -> str:
    for label in labels:
        name = str(label.get("name") or "")
        if name.startswith("task:"):
            return name.split(":", 1)[1]
    return "feature"


def resolve_metric(metric: str, scope: str, commit: str) -> int | None:
    name, detail = metric_name_and_detail(metric)
    target = detail or scope
    if name == "file_count":
        return count_files(target, commit)
    if name == "word_count":
        return count_words(target, commit)
    if name == "class_loc":
        return file_line_count(target, commit)
    if name == "dup_lines":
        return quality_report_value("dup_lines", commit)
    if name == "smell_count":
        return quality_report_value("smell_count", commit)
    return None


def metric_name_and_detail(metric: str) -> tuple[str, str | None]:
    if ":" not in metric:
        return metric, None
    name, detail = metric.split(":", 1)
    return name, detail or None


def quality_report_value(metric: str, commit: str) -> int | None:
    return quality_report_counts(commit).get(metric)


def quality_report_counts(commit: str) -> dict[str, int]:
    if commit in QUALITY_REPORT_CACHE:
        return QUALITY_REPORT_CACHE[commit]
    if commit == "HEAD":
        ensure_quality_reports(REPO_ROOT)
        counts = read_quality_reports(REPO_ROOT)
    else:
        counts = quality_counts_from_worktree(commit)
    QUALITY_REPORT_CACHE[commit] = counts
    return counts


def quality_counts_from_worktree(commit: str) -> dict[str, int]:
    temp_root = Path(tempfile.mkdtemp(prefix="saltmarcher-benefit-quality-"))
    worktree = temp_root / "repo"
    try:
        run(["git", "worktree", "add", "--detach", str(worktree), commit], REPO_ROOT)
        sync_analysis_tooling(worktree)
        ensure_quality_reports(worktree)
        return read_quality_reports(worktree)
    finally:
        run(["git", "worktree", "remove", "--force", str(worktree)], REPO_ROOT, check=False)
        shutil.rmtree(temp_root, ignore_errors=True)


def sync_analysis_tooling(cwd: Path) -> None:
    for name in ("build.gradle.kts", "settings.gradle.kts", "gradle.properties"):
        source = REPO_ROOT / name
        if source.exists():
            (cwd / name).write_text(source.read_text(encoding="utf-8"), encoding="utf-8")
    for name in ("tools/gradle", "tools/quality/config"):
        source = REPO_ROOT / name
        target = cwd / name
        if source.exists():
            if target.exists():
                shutil.rmtree(target)
            shutil.copytree(source, target)


def ensure_quality_reports(cwd: Path) -> None:
    cpd = cwd / "build/reports/quality-trend/cpd-production.xml"
    smells = cwd / "build/reports/quality-trend/design-smells.xml"
    if cpd.exists() and smells.exists():
        return
    run(["./gradlew", "cpdProductionReport", "designSmellReport", "--console=plain"], cwd)


def read_quality_reports(cwd: Path) -> dict[str, int]:
    cpd = cwd / "build/reports/quality-trend/cpd-production.xml"
    smells = cwd / "build/reports/quality-trend/design-smells.xml"
    return {
        "dup_lines": count_cpd_lines(cpd),
        "smell_count": count_pmd_violations(smells),
    }


def count_cpd_lines(path: Path) -> int:
    root = ET.parse(path).getroot()
    total = 0
    for element in root.iter():
        if strip_namespace(element.tag) != "duplication":
            continue
        try:
            total += int(element.attrib.get("lines", "0"))
        except ValueError:
            continue
    return total


def count_pmd_violations(path: Path) -> int:
    root = ET.parse(path).getroot()
    return sum(1 for element in root.iter() if strip_namespace(element.tag) == "violation")


def strip_namespace(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def git_show(commit: str, path: str) -> str | None:
    result = subprocess.run(["git", "show", f"{commit}:{path}"], cwd=REPO_ROOT, text=True, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    return result.stdout if result.returncode == 0 else None


def tracked_files(commit: str) -> list[str]:
    result = subprocess.run(["git", "ls-tree", "-r", "--name-only", commit], cwd=REPO_ROOT, text=True, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    return result.stdout.splitlines() if result.returncode == 0 else []


def count_files(pattern: str, commit: str) -> int:
    return sum(1 for path in tracked_files(commit) if fnmatch.fnmatch(path, pattern))


def count_words(pattern: str, commit: str) -> int:
    total = 0
    for path in tracked_files(commit):
        if not fnmatch.fnmatch(path, pattern):
            continue
        text = git_show(commit, path)
        if text is not None:
            total += len(re.findall(r"[A-Za-z0-9_ÄÖÜäöüß]+", text))
    return total


def file_line_count(path: str, commit: str) -> int | None:
    text = git_show(commit, path)
    return None if text is None else len(text.splitlines())


def benefit_evidence(body: str) -> str | None:
    match = BENEFIT_EVIDENCE_RE.search(body or "")
    if not match:
        return None
    evidence = match.group("evidence").strip()
    lowered = evidence.lower()
    if "one sentence" in lowered or "after readback" in lowered or "for qualitative claims" in lowered:
        return None
    return evidence


def verdict_for(benefit: Benefit, before: int | None, after: int | None, evidence: str | None = None) -> str:
    if benefit.qualitative:
        return "realized" if evidence else "unverifiable"
    if before is None or after is None:
        return "unverifiable"
    if benefit.direction == "down":
        return "realized" if after < before else "not_realized"
    if benefit.direction == "up":
        return "realized" if after > before else "not_realized"
    return "unverifiable"


def feedback_packet(pr: dict[str, Any], benefit: Benefit, verdict: str, evidence: str | None) -> dict[str, Any]:
    return {
        "schema_version": 1,
        "timestamp": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source": "rq4_benefit_readback",
        "pr_number": pr.get("number"),
        "task_class": task_class(pr.get("labels") or []),
        "delayed_benefit": verdict,
        "score_inputs": {
            "unrealized_benefit_count": 1 if verdict == "not_realized" else 0,
        },
        "benefit": {
            "metric": benefit.metric,
            "direction": benefit.direction,
            "scope": benefit.scope,
            "qualitative": benefit.qualitative,
            "evidence": evidence,
        },
    }


def append_feedback(packet: dict[str, Any], *, dry_run: bool) -> None:
    if dry_run:
        return
    FEEDBACK_DIR.mkdir(parents=True, exist_ok=True)
    path = FEEDBACK_DIR / f"benefit-readback-{datetime.now(timezone.utc).date().isoformat()}.jsonl"
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(packet, ensure_ascii=False, separators=(",", ":")) + "\n")


def append_journal(number: int, verdict: str, metric: str, *, dry_run: bool, mode: str) -> None:
    if dry_run:
        return
    line = f"- RQ4 readback: PR #{number} benefit {verdict} ({metric})"
    if mode == "none":
        return
    if mode == "pending":
        FEEDBACK_DIR.mkdir(parents=True, exist_ok=True)
        path = FEEDBACK_DIR / f"benefit-readback-journal-pending-{datetime.now(timezone.utc).date().isoformat()}.jsonl"
        with path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps({"pr_number": number, "line": line}, ensure_ascii=False, separators=(",", ":")) + "\n")
        return
    month = datetime.now().strftime("%Y-%m")
    path = REPO_ROOT / f"docs/project/journal/{month}.md"
    with path.open("a", encoding="utf-8") as handle:
        handle.write(f"\n{line}\n")


def process(now: datetime, *, dry_run: bool, journal_mode: str, prs: list[dict[str, Any]] | None = None) -> tuple[int, int, int]:
    history = readback_history()
    realized = not_realized = unverifiable = 0
    current = "HEAD"
    for pr in (merged_prs(now) if prs is None else prs):
        number = int(pr.get("number") or 0)
        prior_verdicts = history.get(number, [])
        if prior_verdicts and prior_verdicts[-1] != "unverifiable":
            continue
        benefit = parse_benefit(str(pr.get("body") or ""))
        if benefit is None:
            continue
        evidence = benefit_evidence(str(pr.get("body") or ""))
        before_commit = ((pr.get("mergeCommit") or {}).get("oid")) or current
        metric = benefit.metric or "qualitative"
        before = resolve_metric(metric, benefit.scope or "repo", before_commit) if benefit.metric else None
        after = resolve_metric(metric, benefit.scope or "repo", current) if benefit.metric else None
        verdict = verdict_for(benefit, before, after, evidence)
        if verdict == "unverifiable" and "unverifiable" in prior_verdicts:
            verdict = "not_realized"
        realized += verdict == "realized"
        not_realized += verdict == "not_realized"
        unverifiable += verdict == "unverifiable"
        append_feedback(feedback_packet(pr, benefit, verdict, evidence), dry_run=dry_run)
        append_journal(number, verdict, metric, dry_run=dry_run, mode=journal_mode)
    return realized, not_realized, unverifiable


def render_summary(counts: tuple[int, int, int]) -> str:
    return f"Benefit-Readback: {counts[0]} realisiert / {counts[1]} nicht realisiert / {counts[2]} unpruefbar"


def run_selftest() -> int:
    quantitative = parse_benefit("Benefit: metric=file_count:src/**/*.java; direction=down; scope=repo")
    assert quantitative and quantitative.metric == "file_count:src/**/*.java"
    assert parse_benefit("Benefit: metric=wmc:sm.Foo; direction=down; scope=repo") is None
    assert parse_benefit("Benefit: metric=build_seconds:build; direction=down; scope=repo") is None
    assert parse_benefit("Benefit: metric=startup_ms; direction=down; scope=repo") is None
    qualitative = parse_benefit("Benefit: qualitative=Cleaner selection logic for runner maintenance")
    assert qualitative and qualitative.qualitative
    assert verdict_for(qualitative, None, None) == "unverifiable"
    assert verdict_for(qualitative, None, None, "Seven days of readback evidence exists.") == "realized"
    assert benefit_evidence("Benefit evidence: <one sentence after readback, for qualitative claims only>") is None
    assert benefit_evidence("Benefit evidence: Seven days of follow-up shows cleaner review behavior.") is not None
    assert metric_name_and_detail("class_loc:src/Main.java") == ("class_loc", "src/Main.java")
    assert metric_name_and_detail("smell_count") == ("smell_count", None)
    assert verdict_for(quantitative, 10, 9) == "realized"
    assert verdict_for(quantitative, 10, 10) == "not_realized"
    assert verdict_for(quantitative, None, 9) == "unverifiable"
    print("benefit_readback selftest PASS")
    return 0


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--fixture-pr-json", type=Path)
    parser.add_argument("--journal-mode", choices=("tracked", "pending", "none"), default="tracked")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args(argv)
    if args.self_test:
        return run_selftest()
    prs = None
    if args.fixture_pr_json:
        prs = json.loads(args.fixture_pr_json.read_text(encoding="utf-8"))
    counts = process(datetime.now(timezone.utc), dry_run=args.dry_run, journal_mode=args.journal_mode, prs=prs)
    print(render_summary(counts))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
