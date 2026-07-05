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
    result = subprocess.run(
        ["git", "diff", "--name-only", f"origin/{base_ref}...HEAD"],
        cwd=REPO_ROOT,
        text=True,
        check=True,
        stdout=subprocess.PIPE,
    )
    return [line.strip() for line in result.stdout.splitlines() if line.strip()]


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
