#!/usr/bin/env python3
"""Print scope-filtered continuous-refactoring candidates from local reports."""

from __future__ import annotations

import argparse
import re
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path
import xml.etree.ElementTree as ET


REPO = Path(__file__).resolve().parents[3]


@dataclass(frozen=True)
class Finding:
    category: str
    source: str
    path: str
    detail: str


def normalize_path(value: str) -> str:
    path = Path(value)
    try:
        return str(path.resolve().relative_to(REPO))
    except ValueError:
        text = str(path)
        marker = "SaltMarcher/"
        if marker in text:
            return text.split(marker, 1)[1]
        return text


def in_scope(path: str, scopes: list[str]) -> bool:
    if not scopes:
        return True
    normalized = normalize_path(path)
    return any(normalized == scope or normalized.startswith(scope.rstrip("/") + "/") for scope in scopes)


def pmd_findings(scopes: list[str]) -> list[Finding]:
    report = REPO / "build/reports/pmd/main.xml"
    if not report.is_file() or report.stat().st_size == 0:
        return []
    try:
        root = ET.parse(report).getroot()
    except ET.ParseError as error:
        return [Finding("Review-Owned", "PMD", "build/reports/pmd/main.xml", f"unreadable XML report: {error}")]
    findings: list[Finding] = []
    for file_node in root.findall("{*}file"):
        path = normalize_path(file_node.attrib.get("name", ""))
        if not in_scope(path, scopes):
            continue
        for violation in file_node.findall("{*}violation"):
            rule = violation.attrib.get("rule", "unknown")
            line = violation.attrib.get("beginline", "?")
            message = " ".join((violation.text or "").split())
            category = "Mechanical" if rule in {"UnnecessaryImport", "UnusedAssignment"} else "Blocking"
            findings.append(Finding(category, "PMD", path, f"{rule} line {line}: {message}"))
    return findings


def cpd_findings(scopes: list[str]) -> list[Finding]:
    report = REPO / "build/reports/cpd/main.txt"
    if not report.is_file():
        return []
    text = report.read_text(encoding="utf-8", errors="replace")
    blocks = text.split("Found a ")
    findings: list[Finding] = []
    path_pattern = re.compile(r"Starting at line (\d+) of (.+)")
    for block in blocks:
        matches = path_pattern.findall(block)
        if not matches:
            continue
        paths = [(line, normalize_path(path.strip())) for line, path in matches]
        scoped_paths = [(line, path) for line, path in paths if in_scope(path, scopes)]
        if not scoped_paths:
            continue
        all_paths = ", ".join(f"{path}:{line}" for line, path in paths)
        for _line, scoped_path in scoped_paths:
            findings.append(Finding("Duplicate", "CPD", scoped_path, f"duplicate block also appears in {all_paths}"))
    return findings


def lizard_findings(scopes: list[str]) -> list[Finding]:
    report = REPO / "build/reports/lizard/main.txt"
    if not report.is_file():
        return []
    findings: list[Finding] = []
    for line in report.read_text(encoding="utf-8", errors="replace").splitlines():
        if "warning" not in line.lower() and "exceeded" not in line.lower():
            continue
        for token in line.split():
            if token.endswith(".java") and in_scope(token, scopes):
                findings.append(Finding("Blocking", "Lizard", normalize_path(token), line.strip()))
    return findings


def ckjm_findings(scopes: list[str]) -> list[Finding]:
    report = REPO / "build/reports/ckjm/summary.md"
    if not report.is_file():
        return []
    findings: list[Finding] = []
    current_heading = ""
    for line in report.read_text(encoding="utf-8", errors="replace").splitlines():
        if line.startswith("#"):
            current_heading = line.strip("# ")
        if ".java" not in line and "src." not in line:
            continue
        if scopes and not any(scope.replace("/", ".") in line or scope in line for scope in scopes):
            continue
        findings.append(Finding("Review-Owned", "CKJM", current_heading or "ckjm", line.strip()))
    return findings


def latest_handoff_log() -> Path | None:
    logs = sorted((REPO / "build/gradle-run-logs").glob("*production-handoff.log"))
    return logs[-1] if logs else None


def log_findings(scopes: list[str]) -> list[Finding]:
    log = latest_handoff_log()
    if log is None:
        return []
    findings: list[Finding] = []
    path_pattern = re.compile(r"((?:bootstrap|shell|src|tools)/[A-Za-z0-9_./-]+\.java)")
    for line in log.read_text(encoding="utf-8", errors="replace").splitlines():
        if "FAILED" not in line and "[layering-" not in line and "error:" not in line:
            continue
        paths = [normalize_path(match) for match in path_pattern.findall(line)]
        if paths:
            for path in paths:
                if in_scope(path, scopes):
                    findings.append(Finding("Blocking", f"handoff:{log.name}", path, line.strip()))
        elif not scopes and ("FAILED" in line or "BUILD FAILED" in line):
            findings.append(Finding("Blocking", f"handoff:{log.name}", "repo", line.strip()))
    return findings


def collect(scopes: list[str]) -> list[Finding]:
    findings: list[Finding] = []
    for collector in (pmd_findings, cpd_findings, lizard_findings, ckjm_findings, log_findings):
        findings.extend(collector(scopes))
    return findings


def print_markdown(findings: list[Finding], scopes: list[str]) -> None:
    scope_label = ", ".join(scopes) if scopes else "repository"
    print(f"# Continuous Refactoring Candidates: {scope_label}")
    print()
    if not findings:
        print("No local report candidates found for this scope.")
        return
    by_category: dict[str, list[Finding]] = defaultdict(list)
    for finding in findings:
        by_category[finding.category].append(finding)
    for category in ("Blocking", "Mechanical", "Duplicate", "Review-Owned"):
        items = by_category.get(category, [])
        if not items:
            continue
        print(f"## {category}")
        counts = Counter((item.path, item.source) for item in items)
        for (path, source), count in counts.most_common():
            print(f"- `{path}` ({source}, {count})")
            details = [item.detail for item in items if item.path == path and item.source == source][:3]
            for detail in details:
                print(f"  - {detail}")
        print()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--scope", action="append", default=[], help="Repo-relative path scope. May be repeated.")
    args = parser.parse_args()
    scopes = [normalize_path(scope).rstrip("/") for scope in args.scope]
    print_markdown(collect(scopes), scopes)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
