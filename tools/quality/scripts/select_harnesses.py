#!/usr/bin/env python3
"""Select behavior harness Gradle tasks for changed repo paths."""

from __future__ import annotations

import argparse
import fnmatch
import json
import subprocess
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_MAP = REPO_ROOT / "tools/quality/config/harness-map.json"


def changed_files(base_ref: str | None) -> list[str]:
    if not base_ref:
        return []
    subprocess.run(
        ["git", "fetch", "--no-tags", "origin", base_ref],
        cwd=REPO_ROOT,
        check=False,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    return changed_paths_for_range(f"origin/{base_ref}...HEAD")


def changed_paths_for_range(diff_range: str) -> list[str]:
    result = subprocess.run(
        ["git", "diff", "--name-status", "-M", diff_range],
        cwd=REPO_ROOT,
        text=True,
        check=True,
        stdout=subprocess.PIPE,
    )
    paths: list[str] = []
    for line in result.stdout.splitlines():
        fields = line.split("\t")
        if len(fields) < 2:
            continue
        status = fields[0]
        changed = fields[1:]
        if status.startswith(("R", "C")) and len(changed) >= 2:
            candidates = changed[:2]
        else:
            candidates = changed[:1]
        for path in candidates:
            path = path.strip()
            if path and path not in paths:
                paths.append(path)
    return paths


def select_harnesses(paths: list[str], harness_map: dict[str, list[str]]) -> list[str]:
    selected: list[str] = []
    for path in paths:
        normalized = path.removeprefix("./")
        for pattern, harnesses in harness_map.items():
            if fnmatch.fnmatch(normalized, pattern):
                for harness in harnesses:
                    if harness not in selected:
                        selected.append(harness)
    return selected


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--map", default=DEFAULT_MAP)
    parser.add_argument("--base-ref")
    parser.add_argument("paths", nargs="*")
    args = parser.parse_args()

    paths = args.paths or changed_files(args.base_ref)
    harness_map = json.loads(Path(args.map).read_text(encoding="utf-8"))
    for harness in select_harnesses(paths, harness_map):
        print(harness)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
