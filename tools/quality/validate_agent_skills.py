#!/usr/bin/env python3
"""Validate SaltMarcher's canonical and Codex-discoverable agent skills."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CANONICAL_ROOT = ROOT / "tools" / "quality" / "skills"
DISCOVERY_ROOT = ROOT / ".agents" / "skills"
SELECTIONS = {"select", "reject", "clarify"}
INVOCATIONS = {"explicit", "implicit"}
EVAL_FIELDS = {
    "id",
    "invocation",
    "query",
    "expected_selection",
    "expected_behavior",
    "forbidden_behavior",
    "oracle",
}
EVAL_ROOT_FIELDS = {"schema_version", "skill", "proof_scope", "cases"}
INTERFACE_FIELDS = {"display_name", "short_description", "default_prompt"}
POLICY_FIELDS = {"allow_implicit_invocation"}


class ValidationError(RuntimeError):
    pass


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValidationError(message)


def unquote(value: str) -> str:
    value = value.strip()
    if value.startswith('"') or value.endswith('"'):
        require(value.startswith('"') and value.endswith('"'), "unmatched double quote")
        try:
            return json.loads(value)
        except json.JSONDecodeError as error:
            raise ValidationError(f"invalid quoted string: {error}") from error
    if value.startswith("'") or value.endswith("'"):
        require(value.startswith("'") and value.endswith("'"), "unmatched single quote")
        return value[1:-1].replace("''", "'")
    return value


def parse_frontmatter(skill_file: Path) -> dict[str, str]:
    try:
        lines = skill_file.read_text(encoding="utf-8").splitlines()
    except (OSError, UnicodeError) as error:
        raise ValidationError(f"{skill_file}: cannot read: {error}") from error
    require(lines and lines[0] == "---", f"{skill_file}: missing frontmatter start")
    try:
        end = lines.index("---", 1)
    except ValueError as error:
        raise ValidationError(f"{skill_file}: missing frontmatter end") from error

    metadata: dict[str, str] = {}
    for line in lines[1:end]:
        require(":" in line, f"{skill_file}: invalid frontmatter line: {line}")
        key, value = line.split(":", 1)
        key = key.strip()
        require(key not in metadata, f"{skill_file}: duplicate frontmatter key {key}")
        try:
            metadata[key] = unquote(value)
        except ValidationError as error:
            raise ValidationError(f"{skill_file}: {error}") from error
    require(
        set(metadata) == {"name", "description"},
        f"{skill_file}: frontmatter must contain only name and description",
    )
    return metadata


def parse_openai_yaml(yaml_file: Path) -> dict[str, dict[str, object]]:
    sections: dict[str, dict[str, object]] = {}
    current_section: str | None = None
    try:
        lines = yaml_file.read_text(encoding="utf-8").splitlines()
    except (OSError, UnicodeError) as error:
        raise ValidationError(f"{yaml_file}: cannot read: {error}") from error

    for line_number, line in enumerate(lines, start=1):
        if not line.strip():
            continue
        require("\t" not in line, f"{yaml_file}:{line_number}: tabs are not supported")
        if not line.startswith(" "):
            require(
                line.endswith(":") and line.count(":") == 1,
                f"{yaml_file}:{line_number}: invalid top-level entry",
            )
            current_section = line[:-1]
            require(
                current_section in {"interface", "policy"},
                f"{yaml_file}:{line_number}: unsupported section {current_section}",
            )
            require(current_section not in sections, f"{yaml_file}:{line_number}: duplicate section")
            sections[current_section] = {}
            continue

        require(line.startswith("  ") and not line.startswith("   "), f"{yaml_file}:{line_number}: use two-space indentation")
        require(current_section is not None, f"{yaml_file}:{line_number}: field without section")
        require(":" in line, f"{yaml_file}:{line_number}: invalid field")
        key, raw_value = line.strip().split(":", 1)
        fields = sections[current_section]
        require(key not in fields, f"{yaml_file}:{line_number}: duplicate field {key}")
        raw_value = raw_value.strip()
        if current_section == "interface":
            require(key in INTERFACE_FIELDS, f"{yaml_file}:{line_number}: unsupported interface field {key}")
            require(raw_value.startswith('"') and raw_value.endswith('"'), f"{yaml_file}:{line_number}: interface values must be quoted")
            try:
                fields[key] = json.loads(raw_value)
            except json.JSONDecodeError as error:
                raise ValidationError(f"{yaml_file}:{line_number}: invalid quoted value: {error}") from error
        else:
            require(key in POLICY_FIELDS, f"{yaml_file}:{line_number}: unsupported policy field {key}")
            require(raw_value in {"true", "false"}, f"{yaml_file}:{line_number}: policy value must be true or false")
            fields[key] = raw_value == "true"

    require("interface" in sections, f"{yaml_file}: missing interface section")
    require(set(sections["interface"]) == INTERFACE_FIELDS, f"{yaml_file}: interface fields must be {sorted(INTERFACE_FIELDS)}")
    if "policy" in sections:
        require(set(sections["policy"]) == POLICY_FIELDS, f"{yaml_file}: policy fields must be {sorted(POLICY_FIELDS)}")
    return sections


def require_string_list(case: dict[str, object], field: str, source: Path) -> None:
    value = case[field]
    require(
        isinstance(value, list) and value and all(isinstance(item, str) and item.strip() for item in value),
        f"{source}: {case.get('id', '<unknown>')}.{field} must be a non-empty string list",
    )


def validate_evals(skill_name: str, eval_file: Path) -> None:
    try:
        data = json.loads(eval_file.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as error:
        raise ValidationError(f"{eval_file}: invalid JSON: {error}") from error

    require(isinstance(data, dict), f"{eval_file}: root must be an object")
    require(data.get("schema_version") == 1, f"{eval_file}: schema_version must be 1")
    require(set(data) == EVAL_ROOT_FIELDS, f"{eval_file}: root fields must be {sorted(EVAL_ROOT_FIELDS)}")
    require(data.get("skill") == skill_name, f"{eval_file}: skill must be {skill_name}")
    require(
        data.get("proof_scope") == "review-owned; check validates structure only; rerun in fresh contexts after behavior or metadata changes",
        f"{eval_file}: proof_scope must classify cases as review-owned",
    )
    cases = data.get("cases")
    require(isinstance(cases, list) and len(cases) >= 3, f"{eval_file}: at least three cases required")

    ids: set[str] = set()
    selections: set[str] = set()
    for case in cases:
        require(isinstance(case, dict), f"{eval_file}: every case must be an object")
        require(set(case) == EVAL_FIELDS, f"{eval_file}: case fields must be {sorted(EVAL_FIELDS)}")
        case_id = case["id"]
        require(isinstance(case_id, str) and case_id, f"{eval_file}: case id must be non-empty")
        require(case_id not in ids, f"{eval_file}: duplicate case id {case_id}")
        ids.add(case_id)
        invocation = case["invocation"]
        require(
            isinstance(invocation, str) and invocation in INVOCATIONS,
            f"{eval_file}: invalid invocation in {case_id}",
        )
        require(
            isinstance(case["query"], str) and case["query"].strip(),
            f"{eval_file}: query must be non-empty in {case_id}",
        )
        selection = case["expected_selection"]
        require(
            isinstance(selection, str) and selection in SELECTIONS,
            f"{eval_file}: invalid expected_selection in {case_id}",
        )
        selections.add(selection)
        require_string_list(case, "expected_behavior", eval_file)
        require_string_list(case, "forbidden_behavior", eval_file)
        require_string_list(case, "oracle", eval_file)

    require(
        selections == SELECTIONS,
        f"{eval_file}: cases must cover select, reject, and clarify routing",
    )


def validate_skill(skill_dir: Path) -> None:
    skill_name = skill_dir.name
    skill_file = skill_dir / "SKILL.md"
    require(skill_file.is_file(), f"{skill_dir}: missing SKILL.md")
    metadata = parse_frontmatter(skill_file)
    require(metadata["name"] == skill_name, f"{skill_file}: name must match folder")
    description = metadata["description"]
    require(description.strip(), f"{skill_file}: description must be non-empty")
    require(len(description) <= 1024, f"{skill_file}: description exceeds 1024 characters")
    require("<" not in description and ">" not in description, f"{skill_file}: description contains XML")

    yaml_file = skill_dir / "agents" / "openai.yaml"
    require(yaml_file.is_file(), f"{skill_dir}: missing agents/openai.yaml")
    yaml = parse_openai_yaml(yaml_file)
    interface = yaml["interface"]
    display_name = interface["display_name"]
    short_description = interface["short_description"]
    default_prompt = interface["default_prompt"]
    require(isinstance(display_name, str), f"{yaml_file}: display_name must be a string")
    require(isinstance(short_description, str), f"{yaml_file}: short_description must be a string")
    require(isinstance(default_prompt, str), f"{yaml_file}: default_prompt must be a string")
    require(display_name.strip(), f"{yaml_file}: display_name must be non-empty")
    require(25 <= len(short_description) <= 64, f"{yaml_file}: short_description must be 25-64 characters")
    require(f"${skill_name}" in default_prompt, f"{yaml_file}: default_prompt must mention ${skill_name}")

    validate_evals(skill_name, skill_dir / "evals" / "evals.json")


def validate_catalog() -> None:
    require(CANONICAL_ROOT.is_dir(), f"missing canonical skill root: {CANONICAL_ROOT}")
    require(DISCOVERY_ROOT.is_dir(), f"missing discovery skill root: {DISCOVERY_ROOT}")

    canonical = {path.name: path for path in CANONICAL_ROOT.iterdir() if path.is_dir()}
    discovery = {path.name: path for path in DISCOVERY_ROOT.iterdir()}
    require(canonical, "canonical skill catalog must not be empty")
    require(
        set(canonical) == set(discovery),
        "canonical and discovery skill names must match exactly",
    )

    for skill_name, skill_dir in sorted(canonical.items()):
        link = discovery[skill_name]
        require(link.is_symlink(), f"{link}: discovery entry must be a symlink")
        try:
            target_text = os.readlink(link)
            resolved_link = link.resolve(strict=True)
            resolved_skill = skill_dir.resolve(strict=True)
        except OSError as error:
            raise ValidationError(f"{link}: cannot resolve discovery link: {error}") from error
        require(not Path(target_text).is_absolute(), f"{link}: symlink target must be relative")
        require(
            resolved_link == resolved_skill,
            f"{link}: must resolve to {skill_dir}",
        )
        validate_skill(skill_dir)


def main() -> int:
    try:
        validate_catalog()
    except (ValidationError, OSError, UnicodeError, TypeError, ValueError) as error:
        print(f"Agent skill validation failed: {error}", file=sys.stderr)
        return 1
    print("Agent skill validation passed for architecture-planning and callchain-tool.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
