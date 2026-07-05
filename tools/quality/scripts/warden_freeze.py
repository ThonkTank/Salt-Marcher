#!/usr/bin/env python3
"""Guard frozen SaltMarcher gate surfaces and risk-label plausibility."""

from __future__ import annotations

import fnmatch
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]
FREEZE_LIST = REPO_ROOT / "tools/quality/config/frozen-surfaces.txt"
RISK_LABELS = {"risk:R0", "risk:R1", "risk:R2", "risk:R3a", "risk:R3b", "risk:R3c"}
PERSISTENCE_PATTERNS = [
    "src/data/persistencecore/**",
    "src/data/**/*PersistenceSchema.java",
]


def event_payload() -> dict:
    event_path = os.environ.get("GITHUB_EVENT_PATH")
    if not event_path:
        return {}
    path = Path(event_path)
    if not path.is_file():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def labels(payload: dict) -> set[str]:
    pull_request = payload.get("pull_request") or {}
    event_labels = {label.get("name", "") for label in pull_request.get("labels", [])}
    if event_labels:
        return event_labels
    if os.environ.get("GITHUB_EVENT_NAME") != "merge_group":
        return event_labels
    return merge_group_labels(payload)


def merge_group_labels(payload: dict) -> set[str]:
    token = os.environ.get("GITHUB_TOKEN")
    repository = os.environ.get("GITHUB_REPOSITORY")
    head_ref = (payload.get("merge_group") or {}).get("head_ref", "")
    if not token or not repository or not head_ref:
        return set()
    branch = head_ref.rsplit("/", 1)[-1]
    result = subprocess.run(
        ["gh", "pr", "list", "--repo", repository, "--state", "open", "--head", branch, "--json", "labels"],
        cwd=REPO_ROOT,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        env={**os.environ, "GH_TOKEN": token},
    )
    if result.returncode != 0:
        return set()
    prs = json.loads(result.stdout or "[]")
    if not prs:
        return set()
    return {label.get("name", "") for label in prs[0].get("labels", [])}


def changed_files(payload: dict) -> list[str]:
    base_ref = base_reference(payload)
    if not base_ref:
        print("warden-freeze: no PR base ref; audit-only event, passing.")
        return []
    subprocess.run(
        ["git", "fetch", "--no-tags", "origin", base_ref],
        cwd=REPO_ROOT,
        check=False,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    return changed_paths_for_range(REPO_ROOT, f"origin/{base_ref}...HEAD")


def changed_paths_for_range(repo_root: Path, diff_range: str) -> list[str]:
    result = subprocess.run(
        ["git", "diff", "--name-status", "-M", diff_range],
        cwd=repo_root,
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


def changed_line_count(payload: dict) -> int:
    base_ref = base_reference(payload)
    if not base_ref:
        return 0
    result = subprocess.run(
        ["git", "diff", "--numstat", f"origin/{base_ref}...HEAD"],
        cwd=REPO_ROOT,
        text=True,
        check=True,
        stdout=subprocess.PIPE,
    )
    total = 0
    for line in result.stdout.splitlines():
        added, deleted, *_ = line.split("\t")
        if added.isdigit():
            total += int(added)
        if deleted.isdigit():
            total += int(deleted)
    return total


def base_reference(payload: dict) -> str:
    return (
        os.environ.get("GITHUB_BASE_REF")
        or payload.get("pull_request", {}).get("base", {}).get("ref")
        or (payload.get("merge_group") or {}).get("base_ref", "")
    )


def frozen_patterns() -> list[str]:
    return [
        line.strip()
        for line in FREEZE_LIST.read_text(encoding="utf-8").splitlines()
        if line.strip() and not line.strip().startswith("#")
    ]


def matches_any(path: str, patterns: list[str]) -> bool:
    return any(fnmatch.fnmatch(path, pattern) for pattern in patterns)


def contains_sql_marker(path: str) -> bool:
    file_path = REPO_ROOT / path
    if not file_path.is_file() or file_path.suffix != ".java":
        return False
    text = file_path.read_text(encoding="utf-8", errors="ignore")
    return "CREATE TABLE" in text or "ALTER TABLE" in text or "DROP TABLE" in text


def run_self_test() -> int:
    patterns = ["tools/agents/**"]
    with tempfile.TemporaryDirectory(prefix="warden-freeze-self-test-") as tmp:
        repo = Path(tmp)
        run_git(repo, "init", "-q")
        run_git(repo, "config", "user.email", "self-test@example.invalid")
        run_git(repo, "config", "user.name", "Warden Self Test")
        gate = repo / "tools/agents/gate.py"
        gate.parent.mkdir(parents=True)
        gate.write_text("print('gate')\n", encoding="utf-8")
        (repo / "README.md").write_text("base\n", encoding="utf-8")
        run_git(repo, "add", ".")
        run_git(repo, "commit", "-qm", "base")
        run_git(repo, "tag", "base")

        assert_detects(repo, "edit-frozen", patterns, True, lambda root: (root / "tools/agents/gate.py").write_text("print('edit')\n", encoding="utf-8"))
        assert_detects(repo, "new-frozen", patterns, True, lambda root: (root / "tools/agents/new_gate.py").write_text("print('new')\n", encoding="utf-8"))
        assert_detects(repo, "rename-out", patterns, True, lambda root: run_git(root, "mv", "tools/agents/gate.py", "moved_gate.py"))
        assert_detects(repo, "unrelated", patterns, False, lambda root: (root / "README.md").write_text("changed\n", encoding="utf-8"))
    print("warden-freeze: self-test passed")
    return 0


def assert_detects(repo: Path, branch: str, patterns: list[str], expected: bool, mutate) -> None:
    run_git(repo, "checkout", "-qB", branch, "base")
    mutate(repo)
    run_git(repo, "add", "-A")
    run_git(repo, "commit", "-qm", branch)
    changed = changed_paths_for_range(repo, "base...HEAD")
    detected = any(matches_any(path, patterns) for path in changed)
    if detected != expected:
        raise AssertionError(f"{branch}: expected detected={expected}, got {detected}; changed={changed}")


def run_git(repo: Path, *args: str) -> None:
    subprocess.run(["git", *args], cwd=repo, text=True, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)


def main(argv: list[str] | None = None) -> int:
    argv = argv or sys.argv[1:]
    if argv == ["--self-test"]:
        return run_self_test()
    if argv:
        print("usage: warden_freeze.py [--self-test]", file=sys.stderr)
        return 2

    payload = event_payload()
    if os.environ.get("GITHUB_EVENT_NAME") == "push":
        print("warden-freeze: push event is audit-only.")
        return 0

    active_labels = labels(payload)
    risk = active_labels & RISK_LABELS
    changed = changed_files(payload)
    frozen = [path for path in changed if matches_any(path, frozen_patterns())]
    persistence = [
        path for path in changed
        if matches_any(path, PERSISTENCE_PATTERNS) or (path.startswith("src/data/") and contains_sql_marker(path))
    ]

    failures: list[str] = []
    if not risk:
        failures.append("missing risk:* label")
    if len(risk) > 1:
        failures.append("multiple risk:* labels: " + ", ".join(sorted(risk)))
    if frozen and "gate-change-approved" not in active_labels:
        failures.append("frozen paths changed without gate-change-approved: " + ", ".join(frozen))
    if frozen and "risk:R3c" not in risk:
        failures.append("frozen paths require risk:R3c")
    if persistence and not ({"risk:R3a", "risk:R1"} & risk):
        failures.append("persistence schema surfaces require risk:R3a or risk:R1")
    if any(path.startswith("src/") for path in changed) and "risk:R0" in risk and changed_line_count(payload) > 150:
        failures.append("risk:R0 cannot cover src/** diffs over 150 changed lines")

    if failures:
        for failure in failures:
            print(f"warden-freeze: {failure}", file=sys.stderr)
        return 1
    print("warden-freeze: passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
