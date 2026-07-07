#!/usr/bin/env python3
"""Detect repeated identical red-check failures and quarantine stuck PRs."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[3]
MARKER_RE = re.compile(r"<!-- rq6 sig:(?P<sig>[a-f0-9]{64}) attempts:(?P<attempts>\d+) at:(?P<at>[^ ]+) -->")
HEX_RE = re.compile(r"0x[0-9A-Fa-f]+")
TIMESTAMP_RE = re.compile(r"\b\d{4}-\d{2}-\d{2}[T ][0-9:.+-]+Z?\b")
RUN_ID_RE = re.compile(r"\b(?:run|job|attempt)[ _-]?(?:id)?[=: ]+\d+\b", re.IGNORECASE)
QUARANTINE_LABEL = "quarantined:stuck"


@dataclass(frozen=True)
class Marker:
    signature: str
    attempts: int
    at: datetime


@dataclass(frozen=True)
class RecordOutcome:
    body: str
    attempts: int
    quarantined: bool


def gh(args: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(["gh", *args], cwd=REPO_ROOT, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)


def gh_or_raise(args: list[str]) -> subprocess.CompletedProcess[str]:
    result = gh(args)
    if result.returncode != 0:
        raise RuntimeError(result.stdout)
    return result


def normalize_log(text: str) -> str:
    lines = []
    for line in text.splitlines():
        line = TIMESTAMP_RE.sub("<timestamp>", line)
        line = RUN_ID_RE.sub("<run-id>", line)
        line = HEX_RE.sub("<hex>", line)
        lines.append(line)
    return "\n".join(lines[-80:])


def signature(failing_checks: list[str], first_log_tail: str) -> str:
    payload = json.dumps(
        {
            "checks": sorted(set(failing_checks)),
            "tail": normalize_log(first_log_tail),
        },
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def parse_marker(text: str) -> Marker | None:
    match = MARKER_RE.search(text or "")
    if not match:
        return None
    return Marker(
        match.group("sig"),
        int(match.group("attempts")),
        datetime.fromisoformat(match.group("at").replace("Z", "+00:00")),
    )


def marker_text(sig: str, attempts: int, now: datetime) -> str:
    return f"<!-- rq6 sig:{sig} attempts:{attempts} at:{now.astimezone(timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z')} -->"


def update_marker(body: str, sig: str, attempts: int, now: datetime) -> str:
    marker = marker_text(sig, attempts, now)
    if MARKER_RE.search(body or ""):
        return MARKER_RE.sub(marker, body, count=1)
    return (body or "").rstrip() + "\n\n" + marker + "\n"


def record_body(body: str, sig: str, now: datetime) -> RecordOutcome:
    previous = parse_marker(body)
    attempts = previous.attempts + 1 if previous and previous.signature == sig else 1
    return RecordOutcome(update_marker(body, sig, attempts, now), attempts, attempts >= 3)


def gh_pr_body(pr: str, repo: str) -> str:
    return gh_or_raise(["pr", "view", pr, "--repo", repo, "--json", "body", "--jq", ".body // \"\""]).stdout


def set_pr_body(pr: str, repo: str, body: str) -> None:
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", delete=False) as handle:
        handle.write(body)
        path = handle.name
    try:
        gh_or_raise(["pr", "edit", pr, "--repo", repo, "--body-file", path])
    finally:
        Path(path).unlink(missing_ok=True)


def record(pr: str, repo: str, sig: str, now: datetime) -> tuple[int, bool]:
    outcome = record_body(gh_pr_body(pr, repo), sig, now)
    set_pr_body(pr, repo, outcome.body)
    if outcome.quarantined:
        gh_or_raise(["pr", "edit", pr, "--repo", repo, "--add-label", QUARANTINE_LABEL])
        gh_or_raise(["pr", "ready", pr, "--repo", repo, "--undo"])
    return outcome.attempts, outcome.quarantined


def read_fake_store(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {"body": "", "labels": [], "is_draft": False}
    return json.loads(path.read_text(encoding="utf-8"))


def write_fake_store(path: Path, payload: dict[str, Any]) -> None:
    path.write_text(json.dumps(payload, sort_keys=True), encoding="utf-8")


def record_fake(path: Path, sig: str, now: datetime) -> tuple[int, bool]:
    store = read_fake_store(path)
    outcome = record_body(str(store.get("body") or ""), sig, now)
    labels = set(str(label) for label in store.get("labels") or [])
    if outcome.quarantined:
        labels.add(QUARANTINE_LABEL)
        store["is_draft"] = True
    store["body"] = outcome.body
    store["labels"] = sorted(labels)
    write_fake_store(path, store)
    return outcome.attempts, outcome.quarantined


def release_needed(body: str, sig: str, now: datetime) -> bool:
    previous = parse_marker(body)
    if previous is None:
        return False
    return previous.signature != sig or now - previous.at >= timedelta(days=7)


def release(pr: str, repo: str, sig: str, now: datetime) -> bool:
    body = gh_pr_body(pr, repo)
    if not release_needed(body, sig, now):
        return False
    gh_or_raise(["pr", "edit", pr, "--repo", repo, "--remove-label", QUARANTINE_LABEL])
    gh_or_raise(["pr", "ready", pr, "--repo", repo])
    return True


def release_fake(path: Path, sig: str, now: datetime) -> bool:
    store = read_fake_store(path)
    if not release_needed(str(store.get("body") or ""), sig, now):
        return False
    labels = set(str(label) for label in store.get("labels") or [])
    labels.discard(QUARANTINE_LABEL)
    store["labels"] = sorted(labels)
    store["is_draft"] = False
    write_fake_store(path, store)
    return True


def check(body: str, sig: str, now: datetime) -> dict[str, Any]:
    previous = parse_marker(body)
    return {
        "has_marker": previous is not None,
        "attempts": previous.attempts if previous else 0,
        "same_signature": bool(previous and previous.signature == sig),
        "release": release_needed(body, sig, now),
    }


def run_selftest() -> int:
    now = datetime(2026, 7, 7, tzinfo=timezone.utc)
    sig_a = signature(["judge-review", "production-handoff"], "2026-07-07T01:02:03Z run id=123 0xDEADBEEF\nboom")
    sig_a2 = signature(["production-handoff", "judge-review"], "2026-07-07T09:02:03Z run id=999 0xABCDEF\nboom")
    sig_b = signature(["judge-review"], "different")
    assert sig_a == sig_a2
    body = update_marker("body", sig_a, 1, now)
    assert parse_marker(body).attempts == 1
    body = update_marker(body, sig_a, 2, now)
    body = update_marker(body, sig_a, 3, now)
    assert parse_marker(body).attempts == 3
    assert check(body, sig_a, now)["same_signature"] is True
    assert check(body, sig_b, now)["release"] is True
    old = update_marker("body", sig_a, 3, now - timedelta(days=8))
    assert check(old, sig_a, now)["release"] is True
    with tempfile.TemporaryDirectory(prefix="stuck-detector-selftest-") as temp_dir:
        store_path = Path(temp_dir) / "fake-pr.json"
        write_fake_store(store_path, {"body": "fake PR body", "labels": [], "is_draft": False})
        for expected_attempt in (1, 2, 3):
            result = subprocess.run(
                [
                    sys.executable,
                    os.fspath(Path(__file__).resolve()),
                    "record",
                    "--fake-store",
                    os.fspath(store_path),
                    "--signature",
                    sig_a,
                    "--now",
                    now.isoformat(),
                ],
                text=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                check=True,
            )
            payload = json.loads(result.stdout)
            assert payload["attempts"] == expected_attempt
        store = read_fake_store(store_path)
        assert store["labels"] == [QUARANTINE_LABEL]
        assert store["is_draft"] is True
        result = subprocess.run(
            [
                sys.executable,
                os.fspath(Path(__file__).resolve()),
                "release",
                "--fake-store",
                os.fspath(store_path),
                "--signature",
                sig_b,
                "--now",
                now.isoformat(),
            ],
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            check=True,
        )
        assert json.loads(result.stdout)["released"] is True
        store = read_fake_store(store_path)
        assert store["labels"] == []
        assert store["is_draft"] is False
    print("stuck_detector selftest PASS")
    return 0


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=("signature", "check", "record", "release"))
    parser.add_argument("--repo", default="")
    parser.add_argument("--pr", default="")
    parser.add_argument("--body", default="")
    parser.add_argument("--checks-json", default="[]")
    parser.add_argument("--log-file", type=Path)
    parser.add_argument("--signature", default="")
    parser.add_argument("--fake-store", type=Path)
    parser.add_argument("--now", default="")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args(argv)
    if args.self_test:
        return run_selftest()
    now = datetime.fromisoformat(args.now.replace("Z", "+00:00")) if args.now else datetime.now(timezone.utc)
    sig = args.signature
    if args.command == "signature":
        checks = json.loads(args.checks_json)
        log_text = args.log_file.read_text(encoding="utf-8") if args.log_file else sys.stdin.read()
        print(signature([str(item) for item in checks], log_text))
        return 0
    if not sig:
        raise SystemExit("--signature is required")
    if args.command == "check":
        print(json.dumps(check(args.body, sig, now), sort_keys=True))
        return 0
    if args.command == "record" and args.fake_store:
        attempts, quarantined = record_fake(args.fake_store, sig, now)
        print(json.dumps({"attempts": attempts, "quarantined": quarantined}, sort_keys=True))
        return 0
    if args.command == "release" and args.fake_store:
        print(json.dumps({"released": release_fake(args.fake_store, sig, now)}, sort_keys=True))
        return 0
    if not args.repo or not args.pr:
        raise SystemExit("--repo and --pr are required")
    if args.command == "record":
        attempts, quarantined = record(args.pr, args.repo, sig, now)
        print(json.dumps({"attempts": attempts, "quarantined": quarantined}, sort_keys=True))
        return 0
    if args.command == "release":
        print(json.dumps({"released": release(args.pr, args.repo, sig, now)}, sort_keys=True))
        return 0
    raise AssertionError(args.command)


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
