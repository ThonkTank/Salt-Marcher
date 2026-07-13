#!/usr/bin/env python3
"""Read GitHub branch protection/rulesets and append a qualification note."""

from __future__ import annotations

import json
import os
import subprocess
from fnmatch import fnmatch
from datetime import datetime, timezone
from pathlib import Path


REPO = os.environ.get("GITHUB_REPOSITORY", "ThonkTank/Salt-Marcher")
BRANCH = os.environ.get("BRANCH_PROTECTION_BRANCH", "main")
REPO_ROOT = Path(__file__).resolve().parents[3]
JOURNAL = REPO_ROOT / "docs/project/journal" / f"{datetime.now(timezone.utc):%Y-%m}.md"
INTENDED = {
    "check",
    "warden-freeze",
    "judge-review",
}


def gh_api(path: str, *, paginate: bool = False, slurp: bool = False) -> tuple[int, str]:
    args = ["gh", "api"]
    if paginate:
        args.append("--paginate")
    if slurp:
        args.append("--slurp")
    args.append(path)
    result = subprocess.run(
        args,
        cwd=REPO_ROOT,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )
    return result.returncode, result.stdout


def gh_json(path: str, *, paginate: bool = False) -> tuple[bool, str, object | None]:
    code, raw = gh_api(path, paginate=paginate, slurp=paginate)
    if code != 0:
        return False, compact_detail(raw), None
    try:
        return True, "ok", json.loads(raw or "null")
    except json.JSONDecodeError:
        return False, compact_detail(raw), None


def flattened_pages(payload: object) -> list[object]:
    if payload is None:
        return []
    if not isinstance(payload, list):
        return [payload]
    flattened: list[object] = []
    for page in payload:
        if isinstance(page, list):
            flattened.extend(page)
        else:
            flattened.append(page)
    return flattened


def classic_contexts(payload: dict) -> set[str]:
    status_checks = payload.get("required_status_checks") or {}
    contexts = set(status_checks.get("contexts") or [])
    for check in status_checks.get("checks") or []:
        context = check.get("context")
        if context:
            contexts.add(context)
    return contexts


def required_status_rule_contexts(rule: object) -> set[str]:
    if not isinstance(rule, dict):
        return set()
    rule_type = str(rule.get("type", ""))
    if rule_type and rule_type != "required_status_checks":
        return set()
    parameters = rule.get("parameters") or rule
    return collect_status_contexts(parameters)


def collect_status_contexts(payload: object) -> set[str]:
    contexts: set[str] = set()
    if isinstance(payload, dict):
        for key, value in payload.items():
            if key == "context" and isinstance(value, str) and value:
                contexts.add(value)
            elif key in {"contexts", "required_status_checks", "checks"}:
                contexts.update(collect_status_contexts(value))
            elif isinstance(value, (dict, list)):
                contexts.update(collect_status_contexts(value))
    elif isinstance(payload, list):
        for item in payload:
            if isinstance(item, str):
                contexts.add(item)
            else:
                contexts.update(collect_status_contexts(item))
    return contexts


def branch_rule_contexts(payload: object) -> set[str]:
    rules = flattened_pages(payload)
    contexts: set[str] = set()
    for item in rules:
        if isinstance(item, dict) and isinstance(item.get("rules"), list):
            for rule in item["rules"]:
                contexts.update(required_status_rule_contexts(rule))
        else:
            contexts.update(required_status_rule_contexts(item))
    return contexts


def ruleset_applies_to_branch(ruleset: dict) -> bool:
    target = ruleset.get("target")
    if target and target != "branch":
        return False
    conditions = ruleset.get("conditions") or {}
    ref_name = conditions.get("ref_name") or {}
    includes = ref_name.get("include") or []
    excludes = ref_name.get("exclude") or []
    if matches_ref_condition(BRANCH, excludes):
        return False
    if not includes:
        return True
    return matches_ref_condition(BRANCH, includes)


def matches_ref_condition(branch: str, patterns: list[str]) -> bool:
    branch_refs = {
        branch,
        f"refs/heads/{branch}",
        "~DEFAULT_BRANCH" if branch == "main" else "",
    }
    for pattern in patterns:
        if pattern == "~ALL":
            return True
        if pattern in branch_refs:
            return True
        if fnmatch(f"refs/heads/{branch}", pattern) or fnmatch(branch, pattern):
            return True
    return False


def ruleset_contexts_and_details(payload: object) -> tuple[set[str], list[str], bool]:
    contexts: set[str] = set()
    details: list[str] = []
    details_ok = True
    for item in flattened_pages(payload):
        if not isinstance(item, dict) or not ruleset_applies_to_branch(item):
            continue
        ruleset = item
        ruleset_id = item.get("id")
        if ruleset_id is not None:
            ok, detail, detail_payload = gh_json(f"repos/{REPO}/rulesets/{ruleset_id}")
            if ok and isinstance(detail_payload, dict):
                ruleset = detail_payload
                if not ruleset_applies_to_branch(ruleset):
                    continue
            else:
                details_ok = False
                details.append(f"{item.get('name', ruleset_id)}: detail unavailable ({detail})")
        enforcement = str(ruleset.get("enforcement", ""))
        bypass_count = len(ruleset.get("bypass_actors") or [])
        rule_contexts = set()
        for rule in ruleset.get("rules") or []:
            rule_contexts.update(required_status_rule_contexts(rule))
        if enforcement == "active":
            contexts.update(rule_contexts)
        details.append(
            f"{ruleset.get('name', ruleset_id)}: enforcement={enforcement or '<none>'}, "
            f"bypass_actors={bypass_count}, required_checks={format_contexts(rule_contexts)}"
        )
    return contexts, details, details_ok


def format_contexts(contexts: set[str]) -> str:
    return ", ".join(sorted(contexts)) if contexts else "<none>"


def qualification_status(
    observed: set[str],
    *,
    classic_ok: bool,
    classic_detail: str,
    branch_rules_ok: bool,
    rulesets_ok: bool,
    ruleset_details_ok: bool
) -> str:
    classic_endpoint_ok = classic_ok or "HTTP 404" in classic_detail
    if not classic_endpoint_ok:
        return "Not Qualified"
    if not branch_rules_ok or not rulesets_ok or not ruleset_details_ok:
        return "Not Qualified"
    if observed == INTENDED:
        return "Qualified"
    if INTENDED < observed:
        return "Stricter Drift"
    return "Not Qualified"


def compact_detail(raw: str) -> str:
    text = raw.strip()
    if not text:
        return "empty response"
    try:
        payload = json.loads(text)
    except json.JSONDecodeError:
        return text.splitlines()[-1][:160]
    message = payload.get("message", "unknown GitHub API response")
    status = payload.get("status")
    if status:
        return f"{message} (HTTP {status})"
    return message


def main() -> int:
    timestamp = datetime.now(timezone.utc).isoformat(timespec="seconds")
    actor = os.environ.get("GITHUB_ACTOR", "<local>")
    classic_ok, classic_detail, classic_payload = gh_json(f"repos/{REPO}/branches/{BRANCH}/protection")
    branch_rules_ok, branch_rules_detail, branch_rules_payload = gh_json(
        f"repos/{REPO}/rules/branches/{BRANCH}?per_page=100",
        paginate=True
    )
    rulesets_ok, rulesets_detail, rulesets_payload = gh_json(
        f"repos/{REPO}/rulesets?targets=branch&per_page=100",
        paginate=True
    )

    classic_observed = classic_contexts(classic_payload) if isinstance(classic_payload, dict) else set()
    branch_rules_observed = branch_rule_contexts(branch_rules_payload) if branch_rules_ok else set()
    rulesets_observed, ruleset_details, ruleset_details_ok = (
        ruleset_contexts_and_details(rulesets_payload) if rulesets_ok else (set(), [], False)
    )
    observed = classic_observed | branch_rules_observed | rulesets_observed
    status = qualification_status(
        observed,
        classic_ok=classic_ok,
        classic_detail=classic_detail,
        branch_rules_ok=branch_rules_ok,
        rulesets_ok=rulesets_ok,
        ruleset_details_ok=ruleset_details_ok
    )

    entry = (
        f"\n## {timestamp} branch-protection-readback\n\n"
        f"Repository: `{REPO}` branch `{BRANCH}` actor `{actor}`.\n"
        f"Status: `{status}`.\n"
        f"Intended required checks: {format_contexts(INTENDED)}.\n"
        f"Classic branch protection endpoint: `{classic_detail}`; "
        f"required checks: {format_contexts(classic_observed)}.\n"
        f"Branch rules endpoint: `{branch_rules_detail}`; "
        f"required checks: {format_contexts(branch_rules_observed)}.\n"
        f"Rulesets endpoint: `{rulesets_detail}`; "
        f"required checks: {format_contexts(rulesets_observed)}.\n"
        f"Observed required checks: {format_contexts(observed)}.\n"
    )
    if ruleset_details:
        entry += "Ruleset details:\n" + "\n".join(f"- {detail}" for detail in ruleset_details) + "\n"
    JOURNAL.parent.mkdir(parents=True, exist_ok=True)
    with JOURNAL.open("a", encoding="utf-8") as handle:
        handle.write(entry)
    print(entry.strip())
    return 0 if status == "Qualified" else 1


if __name__ == "__main__":
    raise SystemExit(main())
