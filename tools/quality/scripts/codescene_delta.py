#!/usr/bin/env python3
"""Trigger a CodeScene delta analysis from GitHub Actions and fail on quality gates."""

from __future__ import annotations

import base64
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any


REPORT_DIR = Path("build/reports/codescene")
JSON_REPORT = REPORT_DIR / "delta-analysis.json"
MARKDOWN_REPORT = REPORT_DIR / "delta-analysis.md"
DEFAULT_TIMEOUT_SECONDS = 600
DEFAULT_POLL_SECONDS = 5


def main() -> int:
    event_name = require_env("GITHUB_EVENT_NAME")
    event_path = Path(require_env("GITHUB_EVENT_PATH"))
    github_repository = require_env("GITHUB_REPOSITORY")
    event = json.loads(event_path.read_text(encoding="utf-8"))

    base_url = optional_env("CODESCENE_BASE_URL")
    project_id = optional_env("CODESCENE_PROJECT_ID")
    endpoint_override = optional_env("CODESCENE_DELTA_ENDPOINT")
    endpoint = resolve_endpoint(base_url, project_id, endpoint_override)
    token = require_env("CODESCENE_API_TOKEN")
    basic_user = optional_env("CODESCENE_BASIC_USER")
    repository_name = (
        optional_env("CODESCENE_REPOSITORY")
        or github_repository.split("/", 1)[1]
    )
    commits = resolve_commits(event_name, event)
    payload = {
        "commits": commits,
        "repository": repository_name,
    }

    if optional_env("CODESCENE_OFFLINE_MODE", "").lower() in {"1", "true", "yes"}:
        parsed = urllib.parse.urlsplit(endpoint)
        query_parts = urllib.parse.parse_qsl(parsed.query, keep_blank_values=True)
        query_parts.append(("offline-mode", "offline"))
        endpoint = urllib.parse.urlunsplit(
            parsed._replace(query=urllib.parse.urlencode(query_parts))
        )

    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        **build_auth_headers(token, basic_user),
    }

    result_document = post_json(endpoint, payload, headers)
    resource_url = absolutize_url(base_url or endpoint, result_document.get("url", endpoint))
    completed_document = wait_for_result(resource_url, result_document, headers)

    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    JSON_REPORT.write_text(
        json.dumps(completed_document, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    MARKDOWN_REPORT.write_text(
        render_markdown_summary(completed_document, commits, endpoint, resource_url),
        encoding="utf-8",
    )

    failing_gates = find_failing_quality_gates(completed_document)
    if failing_gates:
        print(f"CodeScene quality gates failed: {', '.join(failing_gates)}")
        return 1

    print("CodeScene quality gates passed.")
    return 0


def require_env(name: str) -> str:
    value = os.environ.get(name)
    if value:
        return value
    raise SystemExit(f"Required environment variable is missing: {name}")


def optional_env(name: str, default: str | None = None) -> str | None:
    value = os.environ.get(name)
    if value is None or value == "":
        return default
    return value


def resolve_endpoint(base_url: str | None, project_id: str | None, override: str | None) -> str:
    if override:
        return override
    if not base_url or not project_id:
        raise SystemExit(
            "Set CODESCENE_DELTA_ENDPOINT or provide both CODESCENE_BASE_URL and CODESCENE_PROJECT_ID."
        )
    normalized_base = base_url.rstrip("/")
    return f"{normalized_base}/projects/{project_id}/delta-analysis"


def build_auth_headers(token: str, basic_user: str | None) -> dict[str, str]:
    if basic_user:
        credentials = base64.b64encode(f"{basic_user}:{token}".encode("utf-8")).decode("ascii")
        return {"Authorization": f"Basic {credentials}"}
    return {"Authorization": f"Bearer {token}"}


def resolve_commits(event_name: str, event: dict[str, Any]) -> list[str]:
    github_sha = optional_env("GITHUB_SHA")
    if event_name == "pull_request":
        pull_request = event.get("pull_request", {})
        base_sha = pull_request.get("base", {}).get("sha")
        head_sha = pull_request.get("head", {}).get("sha") or github_sha
        commits = git_rev_list(base_sha, head_sha) if base_sha and head_sha else []
        return commits or ([head_sha] if head_sha else [])

    if event_name == "push":
        before_sha = event.get("before")
        after_sha = event.get("after") or github_sha
        if after_sha and before_sha and not is_zero_sha(before_sha):
            commits = git_rev_list(before_sha, after_sha)
            return commits or [after_sha]
        return [after_sha] if after_sha else []

    if github_sha:
        return [github_sha]

    raise SystemExit(f"Unable to resolve commits for GitHub event '{event_name}'.")


def is_zero_sha(value: str) -> bool:
    return set(value) == {"0"}


def git_rev_list(base_sha: str, head_sha: str) -> list[str]:
    try:
        completed = subprocess.run(
            ["git", "rev-list", "--reverse", f"{base_sha}..{head_sha}"],
            check=True,
            capture_output=True,
            text=True,
        )
    except subprocess.CalledProcessError as exc:
        stderr = exc.stderr.strip()
        if stderr:
            print(f"Falling back to head commit because git rev-list failed: {stderr}", file=sys.stderr)
        return []
    return [line for line in completed.stdout.splitlines() if line]


def post_json(url: str, payload: dict[str, Any], headers: dict[str, str]) -> dict[str, Any]:
    request = urllib.request.Request(
        url=url,
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="POST",
    )
    return request_json(request)


def get_json(url: str, headers: dict[str, str]) -> dict[str, Any]:
    request = urllib.request.Request(url=url, headers=headers, method="GET")
    return request_json(request)


def request_json(request: urllib.request.Request) -> dict[str, Any]:
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            body = response.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        details = exc.read().decode("utf-8", errors="replace").strip()
        raise SystemExit(f"CodeScene API request failed with HTTP {exc.code}: {details}") from exc
    except urllib.error.URLError as exc:
        raise SystemExit(f"CodeScene API request failed: {exc.reason}") from exc

    if not body.strip():
        return {}
    try:
        return json.loads(body)
    except json.JSONDecodeError as exc:
        raise SystemExit(f"CodeScene API returned invalid JSON: {body}") from exc


def wait_for_result(
    resource_url: str,
    initial_document: dict[str, Any],
    headers: dict[str, str],
) -> dict[str, Any]:
    document = initial_document
    if has_completed_result(document):
        return document

    timeout_seconds = int(optional_env("CODESCENE_TIMEOUT_SECONDS", str(DEFAULT_TIMEOUT_SECONDS)) or DEFAULT_TIMEOUT_SECONDS)
    poll_seconds = int(optional_env("CODESCENE_POLL_SECONDS", str(DEFAULT_POLL_SECONDS)) or DEFAULT_POLL_SECONDS)
    deadline = time.time() + timeout_seconds

    while time.time() < deadline:
        time.sleep(poll_seconds)
        document = get_json(resource_url, headers)
        if has_completed_result(document):
            return document

    raise SystemExit(f"Timed out waiting for CodeScene delta analysis at {resource_url}")


def has_completed_result(document: dict[str, Any]) -> bool:
    return isinstance(document.get("result"), dict)


def absolutize_url(base: str, candidate: str) -> str:
    return urllib.parse.urljoin(base if base.endswith("/") else base + "/", candidate)


def find_failing_quality_gates(document: dict[str, Any]) -> list[str]:
    result = document.get("result", {})
    gates = result.get("quality-gates", {})
    return [name for name, value in gates.items() if bool(value)]


def render_markdown_summary(
    document: dict[str, Any],
    commits: list[str],
    endpoint: str,
    resource_url: str,
) -> str:
    result = document.get("result", {})
    warnings = result.get("warnings", [])
    improvements = result.get("improvements", [])
    gates = result.get("quality-gates", {})
    owners = result.get("code-owners-for-quality-gates", [])
    view_url = absolutize_url(endpoint, document.get("view", ""))

    lines = [
        "# CodeScene Delta Analysis",
        "",
        f"- Resource: `{resource_url}`",
        f"- View: {view_url}" if document.get("view") else "- View: not provided",
        f"- Recommended review level: {result.get('recommended-review-level', 'n/a')}",
        f"- Analysed commits: {', '.join(f'`{commit}`' for commit in commits)}",
        "",
        "## Quality Gates",
        "",
    ]

    if gates:
        for gate_name, value in gates.items():
            status = "FAIL" if value else "PASS"
            lines.append(f"- `{gate_name}`: {status}")
    else:
        lines.append("- No quality gate state was returned.")

    if owners:
        lines.extend(["", "## Code Owners", ""])
        for owner in owners:
            lines.append(f"- {owner}")

    if warnings:
        lines.extend(["", "## Warnings", ""])
        for warning in warnings:
            category = warning.get("category", "Warning")
            details = warning.get("details", [])
            lines.append(f"- **{category}**")
            for detail in details:
                lines.append(f"  - {detail}")

    if improvements:
        lines.extend(["", "## Improvements", ""])
        for improvement in improvements:
            if isinstance(improvement, dict):
                description = improvement.get("description") or json.dumps(improvement, sort_keys=True)
            else:
                description = str(improvement)
            lines.append(f"- {description}")

    new_files_info = result.get("new-files-info")
    if new_files_info:
        lines.extend(["", "## New Files", "", f"```json\n{json.dumps(new_files_info, indent=2, sort_keys=True)}\n```"])

    lines.append("")
    return "\n".join(lines)


if __name__ == "__main__":
    sys.exit(main())
