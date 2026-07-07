#!/usr/bin/env python3
"""Synchronize PIT mutation telemetry with harness-gaps.md."""

from __future__ import annotations

import argparse
import json
import re
import sys
import tempfile
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[3]
GENERATED_COVERAGE_RE = re.compile(
    r"^Harness exists, mutation (?:score [0-9.]+%|telemetry timed out|telemetry [A-Za-z0-9_]+)$"
)


def read_summaries(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    summaries = []
    for item in sorted(path.glob("*.json")):
        summaries.append(json.loads(item.read_text(encoding="utf-8")))
    return summaries


def weak_areas(summaries: list[dict[str, Any]]) -> list[dict[str, Any]]:
    weak = []
    for item in summaries:
        status = item.get("status") or "ok"
        if status == "pitest_timeout":
            weak.append(item)
            continue
        if status not in {"ok", "skipped"}:
            weak.append(item)
            continue
        total = int(item.get("mutations_total") or 0)
        score = float(item.get("mutation_score") or 0)
        if total > 0 and score < 50.0:
            weak.append(item)
    return weak


def sync_register(register: Path, summaries: list[dict[str, Any]], *, write: bool) -> str:
    text = register.read_text(encoding="utf-8")
    lines = text.splitlines()
    weak_by_area = {str(item["area"]): item for item in weak_areas(summaries)}
    output: list[str] = []
    seen: set[str] = set()
    in_table = False
    for line in lines:
        if line.startswith("| Area | Current coverage | Priority | Minimal harness proposal |"):
            in_table = True
            output.append(line)
            continue
        if in_table and line.startswith("| --- "):
            output.append(line)
            continue
        if in_table and line.startswith("| "):
            parts = [part.strip() for part in line.strip().strip("|").split("|")]
            if len(parts) == 4:
                area = parts[0].strip("`")
                coverage = parts[1]
                item = weak_by_area.get(area)
                if item:
                    output.append(row_for(item))
                    seen.add(area)
                    continue
                if GENERATED_COVERAGE_RE.match(coverage):
                    continue
            output.append(line)
            continue
        if in_table and not line.startswith("| "):
            for area in sorted(set(weak_by_area) - seen):
                output.append(row_for(weak_by_area[area]))
            in_table = False
        output.append(line)
    if in_table:
        for area in sorted(set(weak_by_area) - seen):
            output.append(row_for(weak_by_area[area]))
    new_text = "\n".join(output) + "\n"
    if write and new_text != text:
        register.write_text(new_text, encoding="utf-8")
    return render_status(summaries)


def row_for(item: dict[str, Any]) -> str:
    status = item.get("status") or "ok"
    if status == "pitest_timeout":
        return (
            f"| `{item['area']}` | Harness exists, mutation telemetry timed out | P2 | "
            "Split or strengthen the harness until monthly mutation telemetry completes under the per-area timeout. |"
        )
    if status not in {"ok", "skipped"}:
        return (
            f"| `{item['area']}` | Harness exists, mutation telemetry {status} | P2 | "
            "Repair the harness adapter or baseline so monthly mutation telemetry produces a score. |"
        )
    score = float(item.get("mutation_score") or 0)
    return (
        f"| `{item['area']}` | Harness exists, mutation score {score:.1f}% | P2 | "
        "Strengthen assertions until mutation score >= 50%. |"
    )


def render_status(summaries: list[dict[str, Any]]) -> str:
    weak = weak_areas(summaries)
    names = ", ".join(str(item["area"]) for item in weak) if weak else "-"
    return f"Mutations-Report (monatlich): Bereiche gesamt {len(summaries)}, unter 50%: {len(weak)} ({names})"


def run_selftest() -> int:
    with tempfile.TemporaryDirectory() as temp:
        root = Path(temp)
        register = root / "harness-gaps.md"
        register.write_text(
            "\n".join([
                "| Area | Current coverage | Priority | Minimal harness proposal |",
                "| --- | --- | --- | --- |",
                "| `src/domain/creatures` | Catalog-adjacent only | P2 | Add a creature catalog harness. |",
            ]) + "\n",
            encoding="utf-8",
        )
        summaries = [
            {"area": "src/domain/party/**", "mutations_total": 10, "mutation_score": 40.0},
            {"area": "src/domain/worldplanner/**", "mutations_total": 10, "mutation_score": 80.0},
            {"area": "src/view/catalog/**", "status": "pitest_timeout", "mutations_total": 0, "mutation_score": 0},
            {"area": "src/view/hexmap/**", "status": "pitest_failed", "mutations_total": 0, "mutation_score": 0},
        ]
        status = sync_register(register, summaries, write=True)
        text = register.read_text(encoding="utf-8")
        assert "src/domain/party/**" in text
        assert "src/view/catalog/**" in text
        assert "src/view/hexmap/**" in text
        assert "unter 50%: 3" in status
        sync_register(
            register,
            [
                {"area": "src/domain/party/**", "status": "ok", "mutations_total": 10, "mutation_score": 60.0},
                {"area": "src/view/catalog/**", "status": "ok", "mutations_total": 10, "mutation_score": 60.0},
                {"area": "src/view/hexmap/**", "status": "ok", "mutations_total": 10, "mutation_score": 60.0},
            ],
            write=True,
        )
        resolved_text = register.read_text(encoding="utf-8")
        assert "src/domain/party/**" not in resolved_text
        assert "src/view/catalog/**" not in resolved_text
        assert "src/view/hexmap/**" not in resolved_text
    print("mutation_gap_sync selftest PASS")
    return 0


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--summaries-dir", type=Path, default=REPO_ROOT / "build/reports/pitest-areas")
    parser.add_argument("--register", type=Path, default=REPO_ROOT / "docs/project/verification/harness-gaps.md")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args(argv)
    if args.self_test:
        return run_selftest()
    summaries = read_summaries(args.summaries_dir)
    print(sync_register(args.register, summaries, write=not args.dry_run))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
