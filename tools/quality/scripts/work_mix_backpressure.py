#!/usr/bin/env python3
"""Evaluate RQ-2 work-mix selection backpressure."""

from __future__ import annotations

import argparse
import json
import sys


CAP_PERCENT = 35.0
MIN_SAMPLE = 10
EXEMPT_SOURCES = {
    "p0p1",
    "red-pr",
    "owner-feedback",
    "runner-drift",
}


def decision(meta_ratio: float, non_bot_merges: int, candidate_class: str, task_source: str) -> dict[str, object]:
    enforced = non_bot_merges >= MIN_SAMPLE and meta_ratio > CAP_PERCENT
    meta_only = candidate_class == "meta"
    exempt = task_source in EXEMPT_SOURCES
    admissible = not (enforced and meta_only and not exempt)
    result = "enforced" if enforced else "telemetry-only"
    return {
        "meta_merge_ratio_14d": round(meta_ratio, 1),
        "non_bot_merges_14d": non_bot_merges,
        "result": result,
        "candidate_class": candidate_class,
        "task_source": task_source,
        "admissible": admissible,
        "status_line": f"work-mix: {meta_ratio:.1f}% -> {result}",
    }


def run_selftest() -> int:
    below_sample = decision(90.0, 9, "meta", "self-directed")
    assert below_sample["result"] == "telemetry-only"
    assert below_sample["admissible"] is True
    skipped = decision(45.0, 10, "meta", "self-directed")
    assert skipped["result"] == "enforced"
    assert skipped["admissible"] is False
    product = decision(45.0, 10, "product", "self-directed")
    assert product["admissible"] is True
    exempt = decision(45.0, 10, "meta", "owner-feedback")
    assert exempt["admissible"] is True
    print("work_mix_backpressure selftest PASS")
    return 0


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--meta-ratio", type=float, required=False, default=0.0)
    parser.add_argument("--non-bot-merges", type=int, required=False, default=0)
    parser.add_argument("--candidate-class", choices=["product", "meta"], default="meta")
    parser.add_argument(
        "--task-source",
        default="self-directed",
        help="Selection source such as p0p1, red-pr, owner-feedback, runner-drift, migration, or self-directed.",
    )
    parser.add_argument("--json", action="store_true")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args(argv)
    if args.self_test:
        return run_selftest()
    item = decision(args.meta_ratio, args.non_bot_merges, args.candidate_class, args.task_source)
    if args.json:
        print(json.dumps(item, ensure_ascii=False, separators=(",", ":")))
    else:
        print(item["status_line"])
        if not item["admissible"]:
            print("meta candidate skipped by RQ-2 work-mix backpressure")
    return 0 if item["admissible"] else 3


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
