#!/usr/bin/env python3
"""Compute RQ-3 quality trend deltas for production sources."""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]
REPORT_DIR = Path("build/reports/quality-trend")
CPD_XML = REPORT_DIR / "cpd-production.xml"
SMELL_XML = REPORT_DIR / "design-smells.xml"
DELTA_JSON = REPORT_DIR / "delta.json"
DELTA_TABLE = REPORT_DIR / "delta.md"
BENEFIT_REQUIRED_CLASSES = {"quality", "consolidation", "architecture", "performance"}
BENEFIT_BLOCKING_CLASSES = {"quality", "consolidation"}


def run(cmd: list[str], cwd: Path, *, check: bool = True) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(cmd, cwd=cwd, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    if check and result.returncode != 0:
        raise RuntimeError(f"{' '.join(cmd)} failed in {cwd}:\n{result.stdout}")
    return result


def run_reports(cwd: Path) -> None:
    result = run(["./gradlew", "cpdProductionReport", "designSmellReport", "--console=plain"], cwd, check=False)
    if result.returncode == 0:
        return
    if "Task 'cpdProductionReport' not found" in result.stdout or "Task 'designSmellReport' not found" in result.stdout:
        sync_analysis_tooling(cwd)
        run(["./gradlew", "cpdProductionReport", "designSmellReport", "--console=plain"], cwd)
        return
    raise RuntimeError(f"./gradlew cpdProductionReport designSmellReport --console=plain failed in {cwd}:\n{result.stdout}")


def sync_analysis_tooling(cwd: Path) -> None:
    for name in ("build.gradle.kts", "settings.gradle.kts", "gradle.properties"):
        source = REPO_ROOT / name
        if source.exists():
            shutil.copy2(source, cwd / name)
    for name in ("tools/gradle", "tools/quality/config"):
        source = REPO_ROOT / name
        target = cwd / name
        if source.exists():
            if target.exists():
                shutil.rmtree(target)
            shutil.copytree(source, target)


def count_cpd_lines(path: Path) -> int:
    require_report(path)
    root = ET.parse(path).getroot()
    total = 0
    for duplication in root.iter():
        if strip_namespace(duplication.tag) != "duplication":
            continue
        try:
            total += int(duplication.attrib.get("lines", "0"))
        except ValueError:
            continue
    return total


def count_smells(path: Path) -> int:
    require_report(path)
    root = ET.parse(path).getroot()
    return sum(1 for element in root.iter() if strip_namespace(element.tag) == "violation")


def require_report(path: Path) -> None:
    if not path.exists():
        raise RuntimeError(f"Expected quality report was not written: {path}")
    if path.stat().st_size == 0:
        raise RuntimeError(f"Expected quality report is empty: {path}")


def strip_namespace(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def collect_counts(cwd: Path) -> tuple[int, int]:
    return count_cpd_lines(cwd / CPD_XML), count_smells(cwd / SMELL_XML)


def merge_base() -> str:
    result = run(["git", "merge-base", "origin/main", "HEAD"], REPO_ROOT)
    return result.stdout.strip()


def prepare_worktree(base_ref: str) -> Path:
    temp_root = Path(tempfile.mkdtemp(prefix="saltmarcher-quality-delta-"))
    worktree = temp_root / "base"
    try:
        run(["git", "worktree", "add", "--detach", str(worktree), base_ref], REPO_ROOT)
        return worktree
    except Exception:
        shutil.rmtree(temp_root, ignore_errors=True)
        raise


def remove_worktree(worktree: Path) -> None:
    run(["git", "worktree", "remove", "--force", str(worktree)], REPO_ROOT, check=False)
    shutil.rmtree(worktree.parent, ignore_errors=True)


def compute_delta(*, run_gradle: bool = True) -> dict[str, int]:
    base_ref = merge_base()
    worktree = prepare_worktree(base_ref)
    try:
        sync_analysis_tooling(worktree)
        if run_gradle:
            run_reports(worktree)
            run_reports(REPO_ROOT)
        dup_base, smell_base = collect_counts(worktree)
        dup_head, smell_head = collect_counts(REPO_ROOT)
    finally:
        remove_worktree(worktree)
    return {
        "dup_lines_base": dup_base,
        "dup_lines_head": dup_head,
        "dup_delta": dup_head - dup_base,
        "smell_base": smell_base,
        "smell_head": smell_head,
        "smell_delta": smell_head - smell_base,
    }


def render_table(delta: dict[str, int]) -> str:
    return "\n".join(
        [
            "| Metric | Base | Head | Delta |",
            "| --- | ---: | ---: | ---: |",
            f"| duplicated production lines | {delta['dup_lines_base']} | {delta['dup_lines_head']} | {delta['dup_delta']} |",
            f"| production design smells | {delta['smell_base']} | {delta['smell_head']} | {delta['smell_delta']} |",
        ]
    )


def write_outputs(delta: dict[str, int]) -> None:
    output_dir = REPO_ROOT / REPORT_DIR
    output_dir.mkdir(parents=True, exist_ok=True)
    (REPO_ROOT / DELTA_JSON).write_text(json.dumps(delta, indent=2) + "\n", encoding="utf-8")
    (REPO_ROOT / DELTA_TABLE).write_text(render_table(delta) + "\n", encoding="utf-8")


def read_existing_delta() -> dict[str, int]:
    path = REPO_ROOT / DELTA_JSON
    if not path.exists():
        raise RuntimeError(f"Existing delta JSON not found: {path}")
    payload = json.loads(path.read_text(encoding="utf-8"))
    return {key: int(payload[key]) for key in (
        "dup_lines_base",
        "dup_lines_head",
        "dup_delta",
        "smell_base",
        "smell_head",
        "smell_delta",
    )}


def enforce(delta: dict[str, int], classes: set[str], task_class: str, has_health_debt: bool) -> int:
    if task_class in {"quality", "consolidation"} and classes.intersection({"quality", "consolidation"}):
        if delta["dup_delta"] > 0 or delta["smell_delta"] > 0:
            return 2
    if task_class == "architecture" and "architecture" in classes:
        if delta["dup_delta"] > 0:
            return 2
        if delta["smell_delta"] > 2:
            return 2
        if delta["smell_delta"] > 0 and not has_health_debt:
            return 2
    return 0


def task_class_from_labels(labels: list[str]) -> str:
    task_labels = []
    for label in labels:
        if label.startswith("task:"):
            value = label.split(":", 1)[1]
            if value in {
                "feature",
                "bug",
                "architecture",
                "quality",
                "performance",
                "consolidation",
                "docs",
                "verification",
                "governance",
            }:
                task_labels.append(value)
            else:
                raise ValueError(f"Unknown task label: {label}")
    if len(task_labels) > 1:
        raise ValueError(f"Expected exactly one task:<class> label, found: {', '.join('task:' + item for item in task_labels)}")
    if len(task_labels) == 1:
        return task_labels[0]
    return "feature"


def labels_from_env() -> list[str]:
    raw = os.environ.get("PR_LABELS_JSON", "[]")
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        payload = []
    labels = []
    for item in payload:
        if isinstance(item, str):
            labels.append(item)
        elif isinstance(item, dict):
            labels.append(str(item.get("name") or ""))
    return labels


def pr_body_has_benefit() -> bool:
    body = os.environ.get("PR_BODY", "")
    quantitative = re.compile(
        r"^Benefit:\s+metric=(dup_lines|smell_count|class_loc:[^;]+|file_count:[^;]+|word_count:[^;]+); "
        r"direction=(down|up); scope=([^<>\s;][^;\n]*)$",
        re.MULTILINE,
    )
    qualitative = re.compile(r"^Benefit:\s+qualitative=([^<>\n][^\n]{8,})$", re.MULTILINE)
    return bool(quantitative.search(body) or qualitative.search(body))


def current_diff_has_health_debt() -> bool:
    result = run(["git", "diff", "--unified=0", "origin/main...HEAD", "--", "docs/project/architecture/project-health-debt.md"], REPO_ROOT, check=False)
    if result.returncode != 0:
        return False
    for line in result.stdout.splitlines():
        if not line.startswith("+") or line.startswith("+++"):
            continue
        text = line.lower()
        if "project_health_debt" in text and any(token in text for token in ("smell", "godclass", "toomany", "coupling", "cyclomatic", "dataclass", "ncss", "excessive")):
            return True
    return False


def run_selftest() -> int:
    with tempfile.TemporaryDirectory() as temp:
        root = Path(temp)
        cpd = root / "cpd.xml"
        pmd = root / "pmd.xml"
        cpd.write_text(
            '<pmd-cpd><duplication lines="3"/><duplication lines="7"/></pmd-cpd>',
            encoding="utf-8",
        )
        pmd.write_text(
            '<pmd><file><violation/><violation/></file></pmd>',
            encoding="utf-8",
        )
        assert count_cpd_lines(cpd) == 10
        assert count_smells(pmd) == 2
        delta = {"dup_lines_base": 1, "dup_lines_head": 3, "dup_delta": 2, "smell_base": 4, "smell_head": 4, "smell_delta": 0}
        assert enforce(delta, {"quality"}, "quality", False) == 2
        assert enforce(delta, {"quality"}, "feature", False) == 0
        assert task_class_from_labels(["risk:R1", "task:consolidation"]) == "consolidation"
        assert task_class_from_labels(["risk:R1"]) == "feature"
        try:
            task_class_from_labels(["task:feature", "task:quality"])
            raise AssertionError("multiple task labels should fail")
        except ValueError:
            pass
    print("quality_delta selftest PASS")
    return 0


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--enforce", default="", help="Comma-separated task classes to enforce.")
    parser.add_argument("--task-class", default=os.environ.get("TASK_CLASS"))
    parser.add_argument("--health-debt", action="store_true")
    parser.add_argument("--require-benefit", action="store_true")
    parser.add_argument("--skip-gradle", action="store_true", help="Use existing XML reports.")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args(argv)
    if args.self_test:
        return run_selftest()
    delta = read_existing_delta() if args.skip_gradle else compute_delta(run_gradle=True)
    if not args.skip_gradle:
        write_outputs(delta)
    table = render_table(delta)
    print(table)
    classes = {item.strip() for item in args.enforce.split(",") if item.strip()}
    try:
        task_class = args.task_class or task_class_from_labels(labels_from_env())
    except ValueError as exc:
        print(str(exc))
        return 2
    if args.require_benefit and task_class in BENEFIT_REQUIRED_CLASSES and not pr_body_has_benefit():
        print(f"Missing Benefit line for task:{task_class}.")
        if task_class in BENEFIT_BLOCKING_CLASSES:
            return 2
    has_health_debt = args.health_debt or current_diff_has_health_debt()
    result = enforce(delta, classes, task_class, has_health_debt) if classes else 0
    if result != 0:
        print(f"Quality trend gate failed for task:{task_class}.")
    return result


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
