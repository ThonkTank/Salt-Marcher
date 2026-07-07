#!/usr/bin/env python3
"""Compare the installed runner prompt/policy files with the repo manifest."""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_MANIFEST = REPO_ROOT / "tools/local/runner-manifest.json"
DRIFT_LABEL = "runner-drift"
DRIFT_TITLE = "RUNNER-DRIFT: Installierter Runner weicht vom Manifest ab"


@dataclass(frozen=True)
class EntryResult:
    path: str
    expected: str
    actual: str | None
    status: str


def gh(args: list[str], *, check: bool = False) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["gh", *args],
        cwd=REPO_ROOT,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        check=check,
    )


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_manifest(path: Path) -> dict[str, Any]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if payload.get("schema_version") != 1:
        raise ValueError("runner manifest schema_version must be 1")
    entries = payload.get("entries")
    if not isinstance(entries, list) or not entries:
        raise ValueError("runner manifest must contain at least one entry")
    return payload


def resolve_manifest_path(value: str) -> Path:
    path = Path(value)
    return path if path.is_absolute() else REPO_ROOT / path


def resolve_legacy_path(value: str) -> Path:
    if value == "~":
        return Path.home()
    if value.startswith("~/"):
        return Path.home() / value[2:]
    path = Path(value)
    return path if path.is_absolute() else REPO_ROOT / path


def systemd_unit_result(systemd: dict[str, Any]) -> EntryResult | None:
    if not systemd:
        return None
    unit_path = resolve_manifest_path(str(systemd.get("unit_path") or ""))
    service = str(systemd.get("service") or "saltmarcher-autodev.service")
    exec_start = resolve_manifest_path(str(systemd.get("exec_start_path") or ""))
    expected = f"repo unit with ExecStart={exec_start}"
    if not unit_path.exists():
        return EntryResult(str(unit_path), expected, "missing", "missing")
    content = unit_path.read_text(encoding="utf-8", errors="replace")
    if f"ExecStart={exec_start}" not in content:
        return EntryResult(str(unit_path), expected, "unit file ExecStart drift", "drift")
    linked_unit = Path.home() / ".config/systemd/user" / service
    if not linked_unit.exists():
        return EntryResult(str(unit_path), expected, "user unit link missing", "missing")
    if linked_unit.resolve() != unit_path:
        return EntryResult(str(unit_path), expected, f"user unit links to {linked_unit.resolve()}", "drift")
    unit_readback = subprocess.run(
        ["systemctl", "--user", "cat", service],
        cwd=REPO_ROOT,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        check=False,
    )
    if unit_readback.returncode == 0 and f"ExecStart={exec_start}" not in unit_readback.stdout:
        return EntryResult(str(unit_path), expected, "active unit ExecStart drift", "drift")
    return EntryResult(str(unit_path), expected, "active", "ok")


def compare(manifest_path: Path = DEFAULT_MANIFEST) -> list[EntryResult]:
    manifest = load_manifest(manifest_path)
    results: list[EntryResult] = []
    for raw in manifest["entries"]:
        installed = resolve_manifest_path(str(raw.get("path") or ""))
        expected = str(raw.get("sha256") or "")
        if not expected:
            raise ValueError(f"runner manifest entry has no sha256: {installed}")
        if not installed.exists():
            results.append(EntryResult(str(installed), expected, None, "missing"))
            continue
        actual = sha256_file(installed)
        status = "ok" if actual == expected else "drift"
        results.append(EntryResult(str(installed), expected, actual, status))
    for raw_path in manifest.get("absent_paths", []):
        legacy = resolve_legacy_path(str(raw_path))
        if not legacy.is_absolute():
            raise ValueError(f"runner manifest absent path is not absolute: {legacy}")
        if legacy.exists():
            actual = "present"
            if legacy.is_file():
                actual = sha256_file(legacy)
            results.append(EntryResult(str(legacy), "absent", actual, "drift"))
        else:
            results.append(EntryResult(str(legacy), "absent", None, "ok"))
    systemd_result = systemd_unit_result(manifest.get("systemd") or {})
    if systemd_result is not None:
        results.append(systemd_result)
    return results


def drift_results(results: list[EntryResult]) -> list[EntryResult]:
    return [result for result in results if result.status != "ok"]


def render_status(results: list[EntryResult]) -> str:
    drift = drift_results(results)
    if drift:
        return f"RUNNER-DRIFT: {len(drift)} Datei(en) weichen vom Manifest ab"
    return f"Runner-Manifest: gruen ({len(results)} Datei(en) geprueft)"


def render_issue_body(results: list[EntryResult]) -> str:
    lines = [
        "# RUNNER-DRIFT",
        "",
        "Die installierten Runner-Dateien weichen vom repo-deklarierten Manifest ab.",
        "Es werden nur Pfad und Hashwerte gemeldet; Dateiinhalte werden nicht uebertragen.",
        "",
        "| Pfad | Status | Erwartet | Ist |",
        "| --- | --- | --- | --- |",
    ]
    for result in drift_results(results):
        actual = result.actual or "missing"
        lines.append(f"| `{result.path}` | `{result.status}` | `{result.expected}` | `{actual}` |")
    return "\n".join(lines) + "\n"


def ensure_drift_issue(results: list[EntryResult], repo: str, *, dry_run: bool) -> str:
    drift = drift_results(results)
    if not drift:
        return "no drift"
    body = render_issue_body(results)
    if dry_run:
        return body
    gh([
        "label",
        "create",
        DRIFT_LABEL,
        "--repo",
        repo,
        "--description",
        "Installed runner manifest drift",
        "--color",
        "B60205",
    ])
    existing = gh([
        "issue",
        "list",
        "--repo",
        repo,
        "--state",
        "open",
        "--label",
        DRIFT_LABEL,
        "--search",
        f"{DRIFT_TITLE} in:title",
        "--json",
        "number,title",
        "--jq",
        f".[] | select(.title == \"{DRIFT_TITLE}\") | .number",
    ])
    number = next((line.strip() for line in existing.stdout.splitlines() if line.strip()), "")
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", delete=False) as handle:
        handle.write(body)
        body_path = Path(handle.name)
    try:
        if number:
            gh(["issue", "edit", number, "--repo", repo, "--body-file", str(body_path)], check=True)
            return f"updated issue #{number}"
        created = gh(
            [
                "issue",
                "create",
                "--repo",
                repo,
                "--title",
                DRIFT_TITLE,
                "--label",
                DRIFT_LABEL,
                "--body-file",
                str(body_path),
            ],
            check=True,
        )
        return created.stdout.strip()
    finally:
        body_path.unlink(missing_ok=True)


def run_selftest() -> int:
    with tempfile.TemporaryDirectory(prefix="runner-readback-") as temp_dir:
        root = Path(temp_dir)
        installed = root / "installed-runner.sh"
        installed.write_text("runner-v1\n", encoding="utf-8")
        manifest = root / "runner-manifest.json"
        legacy = root / "legacy-runner.sh"
        manifest.write_text(
            json.dumps(
                {
                    "schema_version": 1,
                    "updated": "2026-07-07",
                    "entries": [{"path": str(installed), "sha256": sha256_file(installed)}],
                    "absent_paths": [str(legacy)],
                }
            ),
            encoding="utf-8",
        )
        clean = compare(manifest)
        assert render_status(clean) == "Runner-Manifest: gruen (2 Datei(en) geprueft)"
        legacy.write_text("legacy\n", encoding="utf-8")
        legacy_drift = compare(manifest)
        assert render_status(legacy_drift) == "RUNNER-DRIFT: 1 Datei(en) weichen vom Manifest ab"
        legacy.unlink()
        installed.write_text("runner-v2\n", encoding="utf-8")
        drift = compare(manifest)
        assert render_status(drift) == "RUNNER-DRIFT: 1 Datei(en) weichen vom Manifest ab"
        assert "`" + str(installed) + "`" in ensure_drift_issue(drift, "owner/repo", dry_run=True)
    print("runner_readback selftest PASS")
    return 0


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--repo", default="ThonkTank/Salt-Marcher")
    parser.add_argument("--issue", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args(argv)
    if args.self_test:
        return run_selftest()
    results = compare(args.manifest)
    print(render_status(results))
    if args.issue and drift_results(results):
        print(ensure_drift_issue(results, args.repo, dry_run=args.dry_run))
    return 1 if drift_results(results) and not args.dry_run else 0


if __name__ == "__main__":
    raise SystemExit(main(__import__("sys").argv[1:]))
