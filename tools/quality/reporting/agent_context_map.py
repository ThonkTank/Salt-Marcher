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
        or surface == "docs/project/architecture/agent-context.md"
    )


def is_markdown(surface: str) -> bool:
    return surface.endswith(".md") or surface == "AGENTS.md"


def surface_class(surface: str) -> str:
    if is_agent_instruction(surface):
        return "agent instruction"
    if under(surface, "src/domain"):
        return "domain production code"
    if under(surface, "src/view"):
        return "view production code"
    if under(surface, "src") or under(surface, "bootstrap") or under(surface, "shell"):
        return "production code"
    if under(surface, "tools/quality") or under(surface, "tools/gradle/build-harness"):
        return "check/enforcement or quality tooling"
    if surface.startswith("docs/project/architecture/"):
        return "project architecture documentation"
    if surface.startswith("docs/project/verification/"):
        return "project verification documentation"
    if surface.startswith("docs/"):
        return "feature or project documentation"
    if surface in {"build.gradle.kts", "settings.gradle.kts"}:
        return "verification wiring"
    return "repo surface"


def mandatory_skills(surface: str) -> tuple[str, ...]:
    skills = ["context-hygiene"]
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
        skills.extend(["continuous-refactoring", "domain-layer"])
    elif under(surface, "src/view"):
        skills.extend(["continuous-refactoring", "view-layer-mvvm"])
    elif under(surface, "src") or under(surface, "bootstrap") or under(surface, "shell"):
        skills.append("continuous-refactoring")
    elif not is_markdown(surface) and (under(surface, "tools/quality") or under(surface, "tools/gradle/build-harness")):
        skills.append("continuous-refactoring")
    return unique(skills)


def owner_candidates(surface: str) -> tuple[str, ...]:
    paths = [
        "/home/aaron/Schreibtisch/projects/AGENTS.md",
        "AGENTS.md",
        "docs/project/architecture/agent-context.md",
        "tools/quality/skills/context-hygiene/SKILL.md",
    ]
    if is_agent_instruction(surface):
        paths.extend([
            "docs/project/architecture/agent-instructions.md",
            "/home/aaron/.codex/skills/local/agent-instruction-engineering/SKILL.md",
        ])
    if under(surface, "src/domain"):
        paths.extend([
            "docs/project/architecture/patterns/domain-layer.md",
            "tools/quality/skills/domain-layer/SKILL.md",
            "docs/project/architecture/enforcement/domain-layer-enforcement.md",
        ])
    if under(surface, "src/view"):
        paths.extend([
            "docs/project/architecture/patterns/view-layer.md",
            "tools/quality/skills/view-layer-mvvm/SKILL.md",
            "docs/project/architecture/enforcement/view-layer-enforcement.md",
        ])
    if under(surface, "tools/quality") or under(surface, "tools/gradle/build-harness"):
        paths.extend([
            "docs/project/verification/quality-platforms.md",
            "docs/project/verification/quality-platforms-local-gates.md",
            "docs/project/architecture/verification-core.md",
        ])
    if is_markdown(surface):
        paths.append("docs/project/architecture/documentation.md")
    return existing(paths)


def verification(surface: str) -> tuple[str, ...]:
    if is_markdown(surface) or surface.startswith("docs/"):
        return ("./gradlew checkDocumentationEnforcement --console=plain",)
    if under(surface, "src") or under(surface, "bootstrap") or under(surface, "shell"):
        return ("tools/gradle/run-staged-verification.sh production-handoff",)
    if under(surface, "tools/quality") or under(surface, "tools/gradle/build-harness"):
        return (
            "run the focused affected package or canonical layer-surface task",
            "run direct script smoke checks for reporting-only tools",
        )
    if surface in {"build.gradle.kts", "settings.gradle.kts"}:
        return ("run focused entrypoints for the affected verification wiring",)
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
