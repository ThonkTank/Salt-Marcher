#!/usr/bin/env python3
"""Triage local exploratory smoke summaries into deduplicated GitHub issues."""

from __future__ import annotations

import argparse
import base64
import io
import json
import subprocess
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from PIL import Image


REPO_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_REPORT_ROOT = REPO_ROOT / "build/reports/exploration"
EXPLORER_LABEL = "explorer-finding"
P1_LABEL = "prio:P1"
P2_LABEL = "prio:P2"
MAX_SCREENSHOT_BYTES = 50_000
THUMBNAIL_WIDTH = 240


def gh(args: list[str], *, check: bool = False) -> subprocess.CompletedProcess[str]:
    return subprocess.run(["gh", *args], cwd=REPO_ROOT, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, check=check)


def latest_summary(report_root: Path = DEFAULT_REPORT_ROOT) -> Path | None:
    summaries = sorted(report_root.glob("*/summary.json"), key=lambda path: path.stat().st_mtime, reverse=True)
    return summaries[0] if summaries else None


def load_summary(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def anomalies(summary: dict[str, Any]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for station in summary.get("stations") or []:
        for anomaly in station.get("anomalies") or []:
            row = dict(anomaly)
            row["station"] = station.get("name")
            row["screenshot"] = station.get("screenshot")
            rows.append(row)
    return rows


def priority(rank: str) -> str:
    return P1_LABEL if rank in {"crash", "uncaught-exception"} else P2_LABEL


def open_issue_signatures(repo: str) -> set[str]:
    result = gh([
        "issue",
        "list",
        "--repo",
        repo,
        "--state",
        "open",
        "--label",
        EXPLORER_LABEL,
        "--json",
        "body",
        "--limit",
        "100",
    ])
    if result.returncode != 0:
        raise RuntimeError(f"Cannot read open explorer-finding issues for dedupe: {result.stdout}")
    signatures = set()
    for issue in json.loads(result.stdout or "[]"):
        body = issue.get("body") or ""
        for line in body.splitlines():
            if line.startswith("Signature: `") and line.endswith("`"):
                signatures.add(line.removeprefix("Signature: `").removesuffix("`"))
    return signatures


def weekly_created_count(repo: str, now: datetime) -> int:
    since = (now - timedelta(days=7)).date().isoformat()
    result = gh([
        "issue",
        "list",
        "--repo",
        repo,
        "--state",
        "all",
        "--label",
        EXPLORER_LABEL,
        "--search",
        f"created:>={since}",
        "--json",
        "number",
        "--limit",
        "100",
    ])
    if result.returncode != 0:
        raise RuntimeError(f"Cannot read weekly explorer-finding issue count: {result.stdout}")
    return len(json.loads(result.stdout or "[]"))


def issue_body(row: dict[str, Any]) -> str:
    excerpt = limited_excerpt(str(row.get("log_excerpt") or row.get("message") or ""))
    return "\n".join([
        "# Explorer Finding",
        "",
        f"Station: `{row.get('station')}`",
        f"Signature: `{row.get('signature')}`",
        f"Rank: `{row.get('rank')}`",
        f"Screenshot: `{row.get('screenshot')}`",
        "",
        "Log excerpt:",
        "```",
        excerpt,
        "```",
        "",
        *screenshot_attachment_lines(row),
    ])


def screenshot_attachment_lines(row: dict[str, Any]) -> list[str]:
    screenshot = Path(str(row.get("screenshot") or ""))
    if not screenshot.is_file():
        return ["Screenshot attachment: nicht lesbar.", ""]
    payload = thumbnail_png_bytes(screenshot)
    if len(payload) > MAX_SCREENSHOT_BYTES:
        return [f"Screenshot attachment: Thumbnail zu gross ({len(payload)} bytes), lokaler Pfad `{screenshot}`.", ""]
    encoded = base64.b64encode(payload).decode("ascii")
    return [
        f"Screenshot attachment: inline PNG thumbnail, {len(payload)} bytes.",
        f"![{row.get('station')} screenshot](data:image/png;base64,{encoded})",
        "",
    ]


def thumbnail_png_bytes(path: Path) -> bytes:
    with Image.open(path) as image:
        image.thumbnail((THUMBNAIL_WIDTH, THUMBNAIL_WIDTH), Image.Resampling.LANCZOS)
        out = io.BytesIO()
        image.save(out, format="PNG", optimize=True)
        return out.getvalue()


def limited_excerpt(text: str) -> str:
    return "\n".join(text.splitlines()[:40])


def create_issue(row: dict[str, Any], repo: str, *, dry_run: bool) -> str:
    labels = [EXPLORER_LABEL, priority(str(row.get("rank") or ""))]
    title = f"Explorer finding: {row.get('station')} {row.get('rank')}"
    body = issue_body(row)
    if dry_run:
        return body
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", delete=False) as handle:
        handle.write(body)
        path = Path(handle.name)
    try:
        result = gh([
            "issue",
            "create",
            "--repo",
            repo,
            "--title",
            title,
            "--label",
            labels[0],
            "--label",
            labels[1],
            "--body-file",
            str(path),
        ], check=True)
        return result.stdout.strip()
    finally:
        path.unlink(missing_ok=True)


def triage(summary_path: Path, repo: str, *, dry_run: bool, now: datetime) -> tuple[int, int, int]:
    summary = load_summary(summary_path)
    rows = anomalies(summary)
    signatures = open_issue_signatures(repo) if not dry_run else set()
    created_this_week = weekly_created_count(repo, now) if not dry_run else 0
    new_count = 0
    seen_this_run: set[str] = set()
    for row in rows:
        signature = str(row.get("signature") or "")
        if not signature or signature in signatures or signature in seen_this_run:
            continue
        seen_this_run.add(signature)
        if created_this_week + new_count >= 3:
            continue
        print(create_issue(row, repo, dry_run=dry_run))
        new_count += 1
    return len(summary.get("stations") or []), len(rows), new_count


def render_status(counts: tuple[int, int, int]) -> str:
    stations, anomalies_count, new_count = counts
    return f"Exploration: {stations} Stationen, {anomalies_count} Anomalien, {new_count} neue Findings (Woche)"


def status_from_latest(report_root: Path = DEFAULT_REPORT_ROOT, repo: str = "ThonkTank/Salt-Marcher") -> str:
    summary_path = latest_summary(report_root)
    if summary_path is None:
        return "Exploration: noch kein Lauf erfasst"
    summary = load_summary(summary_path)
    new_this_week = weekly_created_count(repo, datetime.now(timezone.utc))
    return render_status((len(summary.get("stations") or []), len(anomalies(summary)), new_this_week))


def run_selftest() -> int:
    with tempfile.TemporaryDirectory(prefix="exploration-triage-") as temp_dir:
        root = Path(temp_dir)
        screenshot = root / "synthetic.png"
        Image.new("RGB", (16, 16), color=(255, 0, 0)).save(screenshot)
        summary = root / "summary.json"
        summary.write_text(json.dumps({
            "schema_version": 1,
            "stations": [
                {
                    "name": "synthetic",
                    "screenshot": str(screenshot),
                    "anomalies": [
                        {"rank": "crash", "signature": "synthetic:boom", "message": "boom", "log_excerpt": "boom"},
                        {"rank": "crash", "signature": "synthetic:boom", "message": "boom", "log_excerpt": "boom"},
                    ],
                }
            ],
        }), encoding="utf-8")
        counts = triage(summary, "owner/repo", dry_run=True, now=datetime(2026, 7, 7, tzinfo=timezone.utc))
        assert counts == (1, 2, 1)
        assert render_status(counts) == "Exploration: 1 Stationen, 2 Anomalien, 1 neue Findings (Woche)"
        body = issue_body(anomalies(load_summary(summary))[0])
        assert "Screenshot attachment: inline PNG thumbnail" in body
        assert "data:image/png;base64," in body
        assert limited_excerpt("\n".join(str(i) for i in range(50))).count("\n") == 39
    print("exploration_triage selftest PASS")
    return 0


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--summary", type=Path)
    parser.add_argument("--report-root", type=Path, default=DEFAULT_REPORT_ROOT)
    parser.add_argument("--repo", default="ThonkTank/Salt-Marcher")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--status-only", action="store_true")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args(argv)
    if args.self_test:
        return run_selftest()
    if args.status_only:
        print(status_from_latest(args.report_root))
        return 0
    summary = args.summary or latest_summary(args.report_root)
    if summary is None:
        print("Exploration: noch kein Lauf erfasst")
        return 0
    counts = triage(summary, args.repo, dry_run=args.dry_run, now=datetime.now(timezone.utc))
    print(render_status(counts))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(__import__("sys").argv[1:]))
