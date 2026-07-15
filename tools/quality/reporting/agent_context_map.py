#!/usr/bin/env python3
"""Print a SaltMarcher agent context map for one or more repo surfaces."""

from __future__ import annotations

import argparse
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path

from continuous_refactoring_candidates import collect, normalize_path


REPO = Path(__file__).resolve().parents[3]
DOC_TYPES = ("architecture", "requirements", "contract", "domain", "delivery", "verification")


@dataclass(frozen=True)
class SurfaceMap:
    surface: str
    surface_class: str
    mandatory_skills: tuple[str, ...]
    owner_candidates: tuple[str, ...]
    feature_docs: tuple[str, ...]
    verification: tuple[str, ...]
    source_reference: str


def existing(paths: list[str]) -> tuple[str, ...]:
    return tuple(path for path in paths if (REPO / path).exists())


def unique(items: list[str]) -> tuple[str, ...]:
    result: list[str] = []
    seen: set[str] = set()
    for item in items:
        if item not in seen:
            result.append(item)
            seen.add(item)
    return tuple(result)


def under(surface: str, root: str) -> bool:
    return surface == root or surface.startswith(root + "/")


def feature_from_surface(surface: str) -> str | None:
    parts = surface.split("/")
    if len(parts) >= 3 and parts[0] == "src" and parts[1] in {"domain", "data"}:
        return parts[2]
    if len(parts) >= 2 and parts[0] == "docs" and parts[1] != "project":
        return parts[1]
    return None


def feature_docs(feature: str | None) -> tuple[str, ...]:
    if feature is None:
        return tuple()
    paths = [f"docs/{feature}/README.md"]
    for doc_type in DOC_TYPES:
        root = REPO / "docs" / feature / doc_type
        if root.is_dir():
            paths.extend(str(path.relative_to(REPO)) for path in sorted(root.glob("*.md")))
    domain_doc = f"src/domain/{feature}/DOMAIN.md"
    if (REPO / domain_doc).exists():
        paths.append(domain_doc)
    return existing(paths)


def is_agent_instruction(surface: str) -> bool:
    return (
        surface == "AGENTS.md"
        or surface.endswith("/SKILL.md")
        or surface == "agents/openai.yaml"
        or surface.endswith("/agents/openai.yaml")
        or surface == "docs/project/architecture/agent-instructions.md"
    )


def is_markdown(surface: str) -> bool:
    return surface.endswith(".md") or surface == "AGENTS.md"


def is_repo_tool_instruction_surface(surface: str) -> bool:
    return surface in {
        "tools/quality/skills/repo-tools/SKILL.md",
        "tools/quality/skills/code-exploration/SKILL.md",
        "tools/quality/skills/code-exploration/SKILL.md",
    }


def is_code_exploration_surface(surface: str) -> bool:
    if is_agent_instruction(surface) and not is_repo_tool_instruction_surface(surface):
        return False
    return (
        is_repo_tool_instruction_surface(surface)
        or under(surface, "src")
        or under(surface, "bootstrap")
        or under(surface, "shell")
        or is_verification_wiring_surface(surface)
        or (under(surface, "tools/quality") and not is_markdown(surface))
    )


def is_verification_wiring_surface(surface: str) -> bool:
    return under(surface, "tools/gradle") or surface in {"build.gradle.kts", "settings.gradle.kts"}


def is_quality_tooling_surface(surface: str) -> bool:
    if is_agent_instruction(surface):
        return False
    return under(surface, "tools/quality") or is_verification_wiring_surface(surface)


def is_reporting_tool_surface(surface: str) -> bool:
    return under(surface, "tools/quality/reporting")


def is_quality_enforcement_surface(surface: str) -> bool:
    return (
        is_quality_tooling_surface(surface)
        and not is_verification_wiring_surface(surface)
        and not is_reporting_tool_surface(surface)
    )


def governing_skill_for_agent_metadata(surface: str) -> str | None:
    suffix = "/agents/openai.yaml"
    if not surface.endswith(suffix):
        return None
    return f"{surface.removesuffix(suffix)}/SKILL.md"


def code_exploration_owner(surface: str) -> str | None:
    if not is_code_exploration_surface(surface):
        return None
    return "tools/quality/skills/code-exploration/SKILL.md"


def surface_class(surface: str) -> str:
    if is_agent_instruction(surface):
        return "agent instruction"
    if under(surface, "src/domain"):
        return "domain production code"
    if under(surface, "src/view"):
        return "view production code"
    if under(surface, "src") or under(surface, "bootstrap") or under(surface, "shell"):
        return "production code"
    if is_verification_wiring_surface(surface):
        return "verification wiring"
    if is_quality_tooling_surface(surface):
        return "check/enforcement or quality tooling"
    if surface.startswith("docs/project/architecture/"):
        return "project architecture documentation"
    if surface.startswith("docs/project/verification/"):
        return "project verification documentation"
    if surface.startswith("docs/"):
        return "feature or project documentation"
    return "repo surface"


def mandatory_skills(surface: str) -> tuple[str, ...]:
    skills = ["repo-tools", "code-exploration"]
    if is_code_exploration_surface(surface):
        skills.append("code-exploration")
    if is_agent_instruction(surface):
        skills.append("agent-instruction-engineering")
    if surface.startswith("docs/project/architecture/") or "/architecture/" in surface:
        skills.append("architecture")
    if surface.startswith("docs/project/verification/") or "/verification/" in surface:
        skills.append("verification")
    if "/requirements/" in surface:
        skills.append("requirements")
    if "/contract/" in surface:
        skills.append("contract")
    if "/domain/" in surface and surface.startswith("docs/"):
        skills.append("domain")
    if "/delivery/" in surface:
        skills.append("delivery")
    if under(surface, "src/domain"):
        skills.append("continuous-refactoring")
    elif under(surface, "src/view"):
        skills.append("continuous-refactoring")
    elif under(surface, "src") or under(surface, "bootstrap") or under(surface, "shell"):
        skills.append("continuous-refactoring")
    elif not is_markdown(surface) and is_quality_tooling_surface(surface):
        skills.append("continuous-refactoring")
    return unique(skills)


def owner_candidates(surface: str) -> tuple[str, ...]:
    paths = [
        "workspace AGENTS.md",
        "AGENTS.md",
        "tools/quality/skills/code-exploration/SKILL.md",
        "tools/quality/skills/repo-tools/SKILL.md",
    ]
    if is_agent_instruction(surface):
        paths.extend([
            "docs/project/architecture/agent-instructions.md",
            "tools/quality/skills/agent-instruction-engineering/SKILL.md",
        ])
        sibling_skill = governing_skill_for_agent_metadata(surface)
        if sibling_skill is not None:
            paths.append(sibling_skill)
    if under(surface, "src/domain") or under(surface, "src/view"):
        paths.append("docs/project/architecture/source-architecture.md")
    if is_quality_tooling_surface(surface):
        paths.extend([
            "docs/project/verification/quality-platforms.md",
            "docs/project/verification/quality-platforms-local-gates.md",
            "docs/project/architecture/verification-core.md",
        ])
    exploration_owner = code_exploration_owner(surface)
    if exploration_owner is not None:
        paths.append(exploration_owner)
    if is_markdown(surface):
        paths.append("docs/project/documentation.md")
    return existing(paths)


def verification(surface: str) -> tuple[str, ...]:
    if is_markdown(surface) or surface.startswith("docs/"):
        return ("./gradlew checkDocumentationEnforcement --console=plain",)
    if is_agent_instruction(surface):
        return (
            "./gradlew checkDocumentationEnforcement --console=plain for Markdown instruction surfaces plus derived-metadata consistency review against the governing SKILL.md; broader non-Markdown code, Gradle, build-logic, or verification wiring still follows AGENTS.md and quality-platform docs",
        )
    if under(surface, "src") or under(surface, "bootstrap") or under(surface, "shell"):
        return ("tools/gradle/run-staged-verification.sh production-handoff",)
    if is_verification_wiring_surface(surface):
        return (
            "tools/gradle/run-staged-verification.sh focused-handoff --path <repo-package-or-resource-dir> [--area <area>] when the affected scope is path-representable",
            "tools/gradle/run-staged-verification.sh production-handoff when shared verification-core routing, lifecycle wiring, or the public production-code surface is affected",
        )
    if is_reporting_tool_surface(surface):
        return (
            "identify the required verification surface from AGENTS.md and quality-platform docs; direct script smoke checks are supplemental diagnostics only",
        )
    if is_quality_enforcement_surface(surface):
        return ("tools/gradle/run-staged-verification.sh focused-handoff --path <affected-package-or-resource-dir> [--area <area>]",)
    return ("identify the required verification surface from AGENTS.md before editing",)


def source_reference(surface: str) -> str:
    if surface.startswith("docs/") or is_agent_instruction(surface):
        return (
            "Use source-references when external sources or local source evidence "
            "influence the decision; cite preserved external mirrors and direct repo paths."
        )
    return (
        "Use source-references only if external sources or source-backed decisions "
        "affect this change; local repo facts may be cited by direct path."
    )


def context_map(surface: str) -> SurfaceMap:
    normalized = normalize_path(surface).rstrip("/")
    feature = feature_from_surface(normalized)
    return SurfaceMap(
        surface=normalized,
        surface_class=surface_class(normalized),
        mandatory_skills=mandatory_skills(normalized),
        owner_candidates=owner_candidates(normalized),
        feature_docs=feature_docs(feature),
        verification=verification(normalized),
        source_reference=source_reference(normalized),
    )


def print_list(title: str, items: tuple[str, ...]) -> None:
    print(f"## {title}")
    if not items:
        print("- none found")
        print()
        return
    for item in items:
        print(f"- `{item}`")
    print()


def print_findings(surface: str) -> None:
    findings = collect([surface])
    print("## Continuous Refactoring Candidates")
    if not findings:
        print("- No local report candidates found for this scope.")
        print()
        return
    grouped: dict[str, list[str]] = defaultdict(list)
    for finding in findings:
        grouped[finding.category].append(f"`{finding.path}` ({finding.source}): {finding.detail}")
    for category in ("Blocking", "Mechanical", "Duplicate", "Review-Owned"):
        if category not in grouped:
            continue
        print(f"- {category}")
        for detail in grouped[category][:5]:
            print(f"  - {detail}")
    print()


def print_map(mapped: SurfaceMap) -> None:
    print(f"# Agent Context Map: {mapped.surface}")
    print()
    print(f"- Surface class: `{mapped.surface_class}`")
    print(f"- Source-reference obligation: {mapped.source_reference}")
    print()
    print_list("Mandatory Skills", mapped.mandatory_skills)
    print_list("Canonical Owner Candidates", mapped.owner_candidates)
    print_list("Nearest Feature Docs", mapped.feature_docs)
    print_list("Required Verification", mapped.verification)
    print_findings(mapped.surface)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--surface", action="append", required=True, help="Repo-relative path or directory.")
    args = parser.parse_args()
    for index, surface in enumerate(args.surface):
        if index:
            print("---")
            print()
        print_map(context_map(surface))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
