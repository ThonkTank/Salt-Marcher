#!/usr/bin/env python3
"""Read-only project-health marker, register, and pass-log scanner."""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
import tempfile
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path


MARKER_NAME = "PROJECT_HEALTH_DEBT"
DEBT_ID_RE = re.compile(r"PH-\d{8}-\d{3}")
MARKER_RE = re.compile(
    r"PROJECT_HEALTH_DEBT\[(PH-\d{8}-\d{3})\]:"
    r"(?P<problem>.*?);\s*owner=(?P<owner>.*?);\s*"
    r"remove_when=(?P<remove_when>.*?)\."
)
REGISTER_HEADING_RE = re.compile(r"^##\s+(PH-\d{8}-\d{3})\b")
MARKER_NONE_RE = re.compile(r"^- Marker:\s+none\b", re.IGNORECASE)
PASS_LOG_TERMS = (
    "temporary compatibility",
    "retained compatibility",
    "retained",
    "stale",
    "deferred",
    "review-owned",
    "outside write set",
    "sourceEdge",
    "sourceEdges",
    "MoveHandlePreview",
)
DEFAULT_SCAN_ROOTS = ("AGENTS.md", "docs", "src", "tools")
EXCLUDED_DIRS = {
    ".git",
    ".gradle",
    ".idea",
    "__pycache__",
    "build",
    "out",
    "target",
}


@dataclass(frozen=True)
class Marker:
    debt_id: str
    path: Path
    line: int
    owner: str
    remove_when: str


@dataclass(frozen=True)
class RegisterEntry:
    debt_id: str
    path: Path
    line: int
    markerless: bool
    fields: dict[str, str]


@dataclass(frozen=True)
class IntakeMatch:
    entry: RegisterEntry
    planned_item: str
    matched_field: str
    matched_value: str


CLOSED_STATUSES = {
    "false positive",
    "removed",
    "resolved",
    "superseded",
    "user excluded",
}
CLOSED_RESOLVER_STATUSES = {
    "false positive",
    "resolved",
    "superseded",
    "user excluded",
}
USER_EXCLUDED_MODE = "user excluded"
INTAKE_FIELDS = (
    "marker",
    "owner areas",
    "affected paths",
    "intake trigger",
)
PATH_FIELDS = {"marker", "affected paths", "affected paths or symbols", "intake trigger"}
OWNER_FIELDS = {"owner areas"}


def iter_text_files(paths: list[Path], include_excluded: bool = False) -> list[Path]:
    files: list[Path] = []
    for path in paths:
        if not path.exists():
            continue
        if path.is_file():
            files.append(path)
            continue
        for child in path.rglob("*"):
            if not child.is_file():
                continue
            if not include_excluded and any(part in EXCLUDED_DIRS for part in child.parts):
                continue
            files.append(child)
    return files


def read_lines(path: Path) -> list[str]:
    try:
        return path.read_text(encoding="utf-8").splitlines()
    except UnicodeDecodeError:
        return []


def normalize_status(value: str) -> str:
    return value.strip().casefold()


def normalize_field_name(value: str) -> str:
    return value.strip().casefold()


def normalize_scope_item(value: str) -> str:
    return value.strip().strip("`").strip()


def normalize_owner_item(value: str) -> str:
    return normalize_scope_item(value).casefold()


def split_field_values(value: str) -> list[str]:
    cleaned = value.replace("|", ",").replace(";", ",")
    items: list[str] = []
    for item in cleaned.split(","):
        normalized = normalize_scope_item(item)
        if normalized:
            items.append(normalized)
    return items


def strip_marker_line(value: str) -> str:
    return re.sub(r":\d+$", "", value)


def collect_markers(paths: list[Path]) -> tuple[list[Marker], list[str]]:
    markers: list[Marker] = []
    errors: list[str] = []
    for path in iter_text_files(paths):
        for line_no, line in enumerate(read_lines(path), start=1):
            if f"{MARKER_NAME}[" not in line:
                continue
            if "PH-YYYYMMDD-NNN" in line:
                continue
            match = MARKER_RE.search(line)
            if not match:
                errors.append(f"{path}:{line_no}: malformed {MARKER_NAME} marker")
                continue
            markers.append(
                Marker(
                    debt_id=match.group(1),
                    path=path,
                    line=line_no,
                    owner=match.group("owner").strip(),
                    remove_when=match.group("remove_when").strip(),
                )
            )
    return markers, errors


def parse_register(path: Path) -> tuple[dict[str, RegisterEntry], list[str]]:
    if not path.exists():
        return {}, [f"{path}: register file is missing"]
    lines = read_lines(path)
    entries: dict[str, RegisterEntry] = {}
    errors: list[str] = []
    current_id: str | None = None
    current_line = 0
    markerless = False
    fields: dict[str, str] = {}

    def flush() -> None:
        nonlocal current_id, markerless, fields
        if current_id is None:
            return
        if current_id in entries:
            errors.append(f"{path}:{current_line}: duplicate register id {current_id}")
            return
        entries[current_id] = RegisterEntry(current_id, path, current_line, markerless, dict(fields))

    for line_no, line in enumerate(lines, start=1):
        heading = REGISTER_HEADING_RE.match(line)
        if heading:
            flush()
            current_id = heading.group(1)
            current_line = line_no
            markerless = False
            fields = {}
            continue
        if current_id and MARKER_NONE_RE.match(line):
            markerless = True
        if current_id and line.startswith("- ") and ":" in line:
            key, value = line[2:].split(":", 1)
            fields[normalize_field_name(key)] = value.strip()
    flush()
    return entries, errors


def is_entry_open_for_intake(entry: RegisterEntry) -> bool:
    status = normalize_status(entry.fields.get("status", "Open"))
    resolver_status = normalize_status(entry.fields.get("resolver status", "Open"))
    resolution_mode = normalize_status(entry.fields.get("resolution mode", "Next Matching Touch"))
    if status in CLOSED_STATUSES:
        return False
    if resolver_status in CLOSED_RESOLVER_STATUSES:
        return False
    return resolution_mode != USER_EXCLUDED_MODE


def field_matches_planned_item(
    field_name: str, planned_item: str, field_value: str
) -> tuple[bool, str]:
    planned = normalize_scope_item(planned_item)
    if not planned:
        return False, ""
    planned_owner = normalize_owner_item(planned_item)
    planned_path = strip_marker_line(planned)
    for candidate in split_field_values(field_value):
        if not candidate or candidate == "none":
            continue
        candidate_path = strip_marker_line(candidate)
        if field_name in OWNER_FIELDS:
            if planned_owner == normalize_owner_item(candidate):
                return True, candidate
            continue
        if field_name in PATH_FIELDS:
            if planned_path == candidate_path:
                return True, candidate
            if planned_path.startswith(candidate_path.rstrip("/") + "/"):
                return True, candidate
            if candidate_path.startswith(planned_path.rstrip("/") + "/"):
                return True, candidate
            continue
        if planned == candidate:
            return True, candidate
    return False, ""


def collect_changed_paths(repo_root: Path) -> list[str]:
    commands = (
        ("git", "diff", "--name-only", "HEAD"),
        ("git", "ls-files", "--others", "--exclude-standard"),
    )
    changed: list[str] = []
    seen: set[str] = set()
    for command in commands:
        try:
            result = subprocess.run(
                command,
                cwd=repo_root,
                check=False,
                text=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.DEVNULL,
            )
        except OSError:
            continue
        if result.returncode != 0:
            continue
        for line in result.stdout.splitlines():
            item = line.strip()
            if item and item not in seen:
                changed.append(item)
                seen.add(item)
    return changed


def collect_intake_matches(entries: dict[str, RegisterEntry], planned_items: list[str]) -> list[IntakeMatch]:
    matches: list[IntakeMatch] = []
    for entry in sorted(entries.values(), key=lambda item: item.debt_id):
        if not is_entry_open_for_intake(entry):
            continue
        for field_name in INTAKE_FIELDS:
            field_value = entry.fields.get(field_name, "")
            if not field_value:
                continue
            for planned_item in planned_items:
                matched, matched_value = field_matches_planned_item(field_name, planned_item, field_value)
                if matched:
                    matches.append(IntakeMatch(entry, planned_item, field_name, matched_value))
                    break
            if any(match.entry.debt_id == entry.debt_id for match in matches):
                break
    return matches


def check_marker_register_sync(
    markers: list[Marker], entries: dict[str, RegisterEntry]
) -> list[str]:
    errors: list[str] = []
    marker_counts = Counter(marker.debt_id for marker in markers)
    for debt_id, count in sorted(marker_counts.items()):
        if count > 1:
            locations = ", ".join(
                f"{marker.path}:{marker.line}"
                for marker in markers
                if marker.debt_id == debt_id
            )
            errors.append(f"{debt_id}: duplicate markers at {locations}")
        if debt_id not in entries:
            marker = next(marker for marker in markers if marker.debt_id == debt_id)
            errors.append(f"{marker.path}:{marker.line}: marker {debt_id} has no register entry")
    for debt_id, entry in sorted(entries.items()):
        if entry.markerless:
            continue
        if marker_counts[debt_id] == 0:
            errors.append(f"{entry.path}:{entry.line}: register {debt_id} has no marker")
    return errors


def scan_pass_logs(paths: list[Path]) -> dict[str, list[str]]:
    hits: dict[str, list[str]] = defaultdict(list)
    for path in iter_text_files(paths, include_excluded=True):
        for line_no, line in enumerate(read_lines(path), start=1):
            lowered = line.lower()
            for term in PASS_LOG_TERMS:
                if term.lower() in lowered:
                    hits[term].append(f"{path}:{line_no}")
    return dict(sorted(hits.items()))


def print_summary(markers: list[Marker], entries: dict[str, RegisterEntry], hits: dict[str, list[str]]) -> None:
    print(f"Markers: {len(markers)}")
    print(f"Register entries: {len(entries)}")
    if markers:
        for marker in sorted(markers, key=lambda item: item.debt_id):
            print(f"  {marker.debt_id} {marker.path}:{marker.line} owner={marker.owner}")
    if hits:
        print("Pass-log term hits:")
        for term, locations in hits.items():
            print(f"  {term}: {len(locations)}")
            for location in locations[:5]:
                print(f"    {location}")
            if len(locations) > 5:
                print(f"    ... {len(locations) - 5} more")


def print_intake_matches(matches: list[IntakeMatch]) -> None:
    if not matches:
        print("Debt intake: none")
        return
    print("Debt intake: required")
    for match in matches:
        entry = match.entry
        status = entry.fields.get("status", "Open")
        resolver_status = entry.fields.get("resolver status", "Open")
        required_action = entry.fields.get("required next action", "resolve, close, user-exclude, or report blocker")
        print(
            f"  {entry.debt_id}: {entry.path}:{entry.line} "
            f"status={status} resolver_status={resolver_status}"
        )
        print(
            f"    matched {match.matched_field}: {match.matched_value} "
            f"via {match.planned_item}"
        )
        print(f"    required next action: {required_action}")


def run_scan(args: argparse.Namespace, repo_root: Path) -> int:
    if args.intake_only and not args.intake:
        print("--intake-only requires --intake", file=sys.stderr)
        return 64
    if args.intake and not (
        args.planned_path or args.planned_owner or args.staged or args.worktree
    ):
        print(
            "--intake requires at least one --planned-path, --planned-owner, --staged, or --worktree selector",
            file=sys.stderr,
        )
        return 64
    scopes = [repo_root / scope for scope in (args.scope or DEFAULT_SCAN_ROOTS)]
    register = repo_root / args.register
    markers, marker_errors = ([], []) if args.intake_only else collect_markers(scopes)
    entries, register_errors = parse_register(register)
    sync_errors = [] if args.intake_only else check_marker_register_sync(markers, entries)
    pass_log_hits = {}
    if args.pass_logs:
        pass_log_hits = scan_pass_logs([repo_root / path for path in args.pass_logs])
    errors = marker_errors + register_errors + sync_errors
    if args.intake_only:
        print("Marker/register sync: skipped for intake-only")
        print(f"Register entries: {len(entries)}")
    else:
        print_summary(markers, entries, pass_log_hits)
    if errors:
        print("Errors:", file=sys.stderr)
        for error in errors:
            print(f"  {error}", file=sys.stderr)
        return 1
    if args.strict_pass_logs:
        repeated = {term: hits for term, hits in pass_log_hits.items() if len(hits) >= 2}
        if repeated:
            print("Repeated pass-log families:", file=sys.stderr)
            for term, hits in repeated.items():
                print(f"  {term}: {len(hits)}", file=sys.stderr)
            return 2
    if args.intake:
        planned_items = list(args.planned_path or []) + list(args.planned_owner or [])
        if args.staged or args.worktree:
            planned_items.extend(collect_changed_paths(repo_root))
        matches = collect_intake_matches(entries, planned_items)
        print_intake_matches(matches)
        if matches:
            return 3
    return 0


def run_self_test() -> int:
    with tempfile.TemporaryDirectory() as temp:
        root = Path(temp)
        docs = root / "docs" / "project" / "architecture"
        source = root / "src"
        logs = root / "build" / "agent-pass-logs"
        docs.mkdir(parents=True)
        source.mkdir()
        logs.mkdir(parents=True)
        register = docs / "project-health-debt.md"
        debt_id = "PH-" + "20260622" + "-001"
        marker = (
            MARKER_NAME
            + f"[{debt_id}]: stale routing seam; owner=feature-runtime; "
            + "remove_when=runtime owner deletes the seam."
        )
        (source / "Example.java").write_text("// " + marker + "\n", encoding="utf-8")
        register.write_text(
            f"# Register\n\n## {debt_id} - Stale Routing\n\n"
            "- Status: Open\n"
            "- Marker: src/Example.java:1\n"
            "- Problem: stale routing seam\n"
            "- Owner Areas: feature-runtime\n"
            "- Affected Paths: src/Example.java\n"
            "- Source Evidence: self-test\n"
            "- Decision: test fixture\n"
            "- Remove When: runtime owner deletes the seam\n"
            "- Last Checked: 2026-06-22\n",
            encoding="utf-8",
        )
        logs.joinpath("example.md").write_text(
            "temporary compatibility\nretained compatibility\nstale proof\n",
            encoding="utf-8",
        )
        ok_args = argparse.Namespace(
            scope=["src"],
            register="docs/project/architecture/project-health-debt.md",
            pass_logs=["build/agent-pass-logs"],
            strict_pass_logs=False,
            intake=False,
            intake_only=False,
            planned_path=[],
            planned_owner=[],
            staged=False,
            worktree=False,
        )
        if run_scan(ok_args, root) != 0:
            return 1
        intake_args = argparse.Namespace(
            scope=["src"],
            register="docs/project/architecture/project-health-debt.md",
            pass_logs=[],
            strict_pass_logs=False,
            intake=True,
            intake_only=False,
            planned_path=["src/Example.java"],
            planned_owner=[],
            staged=False,
            worktree=False,
        )
        if run_scan(intake_args, root) != 3:
            print("self-test expected active matching debt intake to fail", file=sys.stderr)
            return 1
        owner_intake_args = argparse.Namespace(
            scope=["src"],
            register="docs/project/architecture/project-health-debt.md",
            pass_logs=[],
            strict_pass_logs=False,
            intake=True,
            intake_only=False,
            planned_path=[],
            planned_owner=["feature-runtime"],
            staged=False,
            worktree=False,
        )
        if run_scan(owner_intake_args, root) != 3:
            print("self-test expected owner-area debt intake to fail", file=sys.stderr)
            return 1
        intake_only_args = argparse.Namespace(
            scope=["src"],
            register="docs/project/architecture/project-health-debt.md",
            pass_logs=[],
            strict_pass_logs=False,
            intake=True,
            intake_only=True,
            planned_path=["src/Example.java"],
            planned_owner=[],
            staged=False,
            worktree=False,
        )
        if run_scan(intake_only_args, root) != 3:
            print("self-test expected intake-only matching debt to fail", file=sys.stderr)
            return 1
        register.write_text(
            f"# Register\n\n## {debt_id} - Stale Routing\n\n"
            "- Status: Open\n"
            "- Marker: none\n"
            "- Problem: stale routing seam\n"
            "- Owner Areas: feature-runtime\n"
            "- Affected Paths: src/dungeon\n"
            "- Source Evidence: self-test\n"
            "- Decision: test fixture\n"
            "- Remove When: runtime owner deletes the seam\n"
            "- Last Checked: 2026-06-22\n",
            encoding="utf-8",
        )
        affected_path_directory_args = argparse.Namespace(
            scope=["src"],
            register="docs/project/architecture/project-health-debt.md",
            pass_logs=[],
            strict_pass_logs=False,
            intake=True,
            intake_only=True,
            planned_path=["src/dungeon/runtime/Example.java"],
            planned_owner=[],
            staged=False,
            worktree=False,
        )
        if run_scan(affected_path_directory_args, root) != 3:
            print("self-test expected affected-path directory debt intake to fail", file=sys.stderr)
            return 1
        register.write_text(
            f"# Register\n\n## {debt_id} - Stale Routing\n\n"
            "- Status: Open\n"
            "- Marker: src/Example.java:1\n"
            "- Problem: stale routing seam\n"
            "- Owner Areas: feature-runtime\n"
            "- Affected Paths: src/Example.java\n"
            "- Source Evidence: self-test\n"
            "- Decision: test fixture\n"
            "- Remove When: runtime owner deletes the seam\n"
            "- Last Checked: 2026-06-22\n",
            encoding="utf-8",
        )
        negative_owner_args = argparse.Namespace(
            scope=["src"],
            register="docs/project/architecture/project-health-debt.md",
            pass_logs=[],
            strict_pass_logs=False,
            intake=True,
            intake_only=False,
            planned_path=["docs/project/architecture/overview.md"],
            planned_owner=[],
            staged=False,
            worktree=False,
        )
        if run_scan(negative_owner_args, root) != 0:
            print("self-test expected owner text not to match unrelated path substrings", file=sys.stderr)
            return 1
        case_distinct_path_args = argparse.Namespace(
            scope=["src"],
            register="docs/project/architecture/project-health-debt.md",
            pass_logs=[],
            strict_pass_logs=False,
            intake=True,
            intake_only=False,
            planned_path=["src/example.java"],
            planned_owner=[],
            staged=False,
            worktree=False,
        )
        if run_scan(case_distinct_path_args, root) != 0:
            print("self-test expected path intake to stay case-sensitive", file=sys.stderr)
            return 1
        selectorless_args = argparse.Namespace(
            scope=["src"],
            register="docs/project/architecture/project-health-debt.md",
            pass_logs=[],
            strict_pass_logs=False,
            intake=True,
            intake_only=False,
            planned_path=[],
            planned_owner=[],
            staged=False,
            worktree=False,
        )
        if run_scan(selectorless_args, root) != 64:
            print("self-test expected selectorless intake to fail usage", file=sys.stderr)
            return 1
        intake_only_without_intake_args = argparse.Namespace(
            scope=["src"],
            register="docs/project/architecture/project-health-debt.md",
            pass_logs=[],
            strict_pass_logs=False,
            intake=False,
            intake_only=True,
            planned_path=["src/Example.java"],
            planned_owner=[],
            staged=False,
            worktree=False,
        )
        if run_scan(intake_only_without_intake_args, root) != 64:
            print("self-test expected intake-only without intake to fail usage", file=sys.stderr)
            return 1
        register.write_text(
            f"# Register\n\n## {debt_id} - Stale Routing\n\n"
            "- Status: Open\n"
            "- Resolver Status: User Excluded\n"
            "- Marker: src/Example.java:1\n"
            "- Problem: stale routing seam\n"
            "- Owner Areas: feature-runtime\n"
            "- Affected Paths: src/Example.java\n"
            "- Intake Trigger: src/Example.java\n"
            "- Source Evidence: self-test\n"
            "- Decision: test fixture\n"
            "- Remove When: runtime owner deletes the seam\n"
            "- Last Checked: 2026-06-22\n",
            encoding="utf-8",
        )
        if run_scan(intake_args, root) != 0:
            print("self-test expected user-excluded intake to pass", file=sys.stderr)
            return 1
        register.write_text("# Register\n", encoding="utf-8")
        if run_scan(intake_only_args, root) != 0:
            print("self-test expected intake-only without registered debt to pass", file=sys.stderr)
            return 1
        if run_scan(ok_args, root) == 0:
            print("self-test expected marker/register mismatch to fail", file=sys.stderr)
            return 1
    print("Self-test passed")
    return 0


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--scope", action="append", help="Repo-relative path to scan for markers")
    parser.add_argument(
        "--register",
        default="docs/project/architecture/project-health-debt.md",
        help="Repo-relative project-health debt register path",
    )
    parser.add_argument(
        "--pass-logs",
        action="append",
        help="Repo-relative pass-log path to scan for repeated families",
    )
    parser.add_argument(
        "--strict-pass-logs",
        action="store_true",
        help="Fail when a pass-log family appears at least twice",
    )
    parser.add_argument("--self-test", action="store_true", help="Run built-in fixtures")
    parser.add_argument(
        "--intake",
        action="store_true",
        help="Fail with exit 3 when active registered debt intersects planned work",
    )
    parser.add_argument(
        "--intake-only",
        action="store_true",
        help="With --intake, skip marker/register sync and enforce only matching debt intake",
    )
    parser.add_argument(
        "--planned-path",
        action="append",
        help="Repo-relative planned path to match against active project-health debt",
    )
    parser.add_argument(
        "--planned-owner",
        action="append",
        help="Owner area to match against active project-health debt",
    )
    parser.add_argument(
        "--staged",
        action="store_true",
        help="Compatibility alias for --worktree",
    )
    parser.add_argument(
        "--worktree",
        action="store_true",
        help="Include current tracked and untracked worktree paths in debt intake",
    )
    return parser.parse_args(argv)


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    if args.self_test:
        return run_self_test()
    return run_scan(args, Path.cwd())


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
