#!/usr/bin/env python3
"""Read-only guard for SaltMarcher workflow artifact authority chains."""

from __future__ import annotations

import argparse
import re
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path


COMPLETED_CONTENT_STATUSES = {"completed", "not required"}
MINIMAL_CHAIN_TRIGGERS = {"used", "required", "true", "yes"}
PRIMARY_ARTIFACTS = {
    "CR": ("Main/User", "Accepted"),
    "Roadmap": ("Planner", "Accepted"),
    "Phase Plan": ("Planner", "Accepted"),
    "Step Plan": ("Planner", "Accepted"),
}


@dataclass(frozen=True)
class Artifact:
    path: Path
    text: str
    fields: dict[str, str]
    duplicate_fields: tuple[str, ...]


def read_artifact(path: Path) -> Artifact:
    text = path.read_text(encoding="utf-8")
    fields: dict[str, str] = {}
    duplicates: list[str] = []
    for line in text.splitlines():
        if line.startswith("#"):
            break
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        normalized = key.strip().casefold()
        if normalized in fields:
            duplicates.append(normalized)
        fields[normalized] = value.strip()
    return Artifact(path, text, fields, tuple(duplicates))


def validate_artifact_path(path: Path, expected_dir: Path, label: str) -> list[str]:
    if not path.exists():
        return [f"{path}: missing {label} artifact"]
    try:
        resolved = path.resolve()
        expected_resolved = expected_dir.resolve()
    except OSError as exc:
        return [f"{path}: cannot resolve {label} artifact path: {exc}"]
    errors: list[str] = []
    if resolved.parent != expected_resolved:
        errors.append(f"{path}: {label} artifact must be in {expected_dir}")
    if not resolved.is_file():
        errors.append(f"{path}: {label} artifact must be a regular file")
    return errors


def field(artifact: Artifact, name: str) -> str:
    return artifact.fields.get(name.casefold(), "").strip()


def field_key(artifact: Artifact, name: str) -> str:
    return field(artifact, name).casefold()


def missing_fields(artifact: Artifact, required: tuple[str, ...]) -> list[str]:
    return [name for name in required if not field(artifact, name)]


def same_path(value: str, path: Path) -> bool:
    if not value:
        return True
    if not Path(value).is_absolute():
        return False
    try:
        return Path(value).resolve() == path.resolve()
    except OSError:
        return False


def path_list(value: str) -> list[Path]:
    if not value or value.casefold() == "none":
        return []
    return [Path(part.strip()) for part in value.split(",") if part.strip()]


def path_list_contains(value: str, path: Path) -> bool:
    candidates = path_list(value)
    if any(not candidate.is_absolute() for candidate in candidates):
        return False
    try:
        target = path.resolve()
    except OSError:
        return False
    for candidate in candidates:
        try:
            if candidate.resolve() == target:
                return True
        except OSError:
            continue
    return False


def path_list_matches(value: str, expected_paths: list[Path]) -> bool:
    actual = path_list(value)
    if len(actual) != len(expected_paths):
        return False
    if any(not path.is_absolute() for path in actual):
        return False
    try:
        actual_resolved = {path.resolve() for path in actual}
        expected_resolved = {path.resolve() for path in expected_paths}
    except OSError:
        return False
    return actual_resolved == expected_resolved


def has_main_role(value: str) -> bool:
    return bool(re.search(r"\bmain\b", value, re.IGNORECASE))


def uses_minimal_chain(*artifacts: Artifact | None) -> bool:
    for artifact in artifacts:
        if artifact is None:
            continue
        for name in ("Minimal Chain", "Minimal Chain Decision"):
            if field_key(artifact, name) in MINIMAL_CHAIN_TRIGGERS:
                return True
    return False


def slug_parts(cr_path: Path) -> tuple[str, str] | None:
    match = re.match(r"^(\d{4}-\d{2}-\d{2})-(.+)-cr\.md$", cr_path.name)
    if not match:
        return None
    return match.group(1), match.group(2)


def path_matches_chain(path: Path, date: str, slug: str, artifact_kind: str) -> bool:
    if artifact_kind == "step":
        pattern = rf"^{re.escape(date)}-{re.escape(slug)}-wave-\d+-.+-plan\.md$"
    elif artifact_kind == "phase":
        pattern = rf"^{re.escape(date)}-{re.escape(slug)}-phase-\d+-plan\.md$"
    else:
        pattern = rf"^{re.escape(date)}-{re.escape(slug)}-{artifact_kind}\.md$"
    return bool(re.match(pattern, path.name))


def roadmap_path_for(cr_path: Path) -> Path | None:
    parts = slug_parts(cr_path)
    if parts is None:
        return None
    date, slug = parts
    return cr_path.with_name(f"{date}-{slug}-roadmap.md")


def cr_review_path_for(cr_path: Path) -> Path:
    return cr_path.with_name(cr_path.name[: -len("-cr.md")] + "-cr-review.md")


def plan_review_path_for(cr_path: Path) -> Path | None:
    parts = slug_parts(cr_path)
    if parts is None:
        return None
    date, slug = parts
    return cr_path.with_name(f"{date}-{slug}-plan-review.md")


def load(path: Path, expected_dir: Path, label: str) -> tuple[list[str], Artifact | None]:
    errors = validate_artifact_path(path, expected_dir, label)
    if errors:
        return errors, None
    return [], read_artifact(path)


def validate_primary(artifact: Artifact, role: str) -> list[str]:
    errors: list[str] = []
    expected_owner, expected_status = PRIMARY_ARTIFACTS[role]
    for duplicate in artifact.duplicate_fields:
        errors.append(f"{artifact.path}: duplicate header field '{duplicate}'")
    for name in missing_fields(artifact, ("Artifact Role", "Owner Role", "Authored By Role", "Status")):
        errors.append(f"{artifact.path}: missing {name}")
    if field(artifact, "Artifact Role") != role:
        errors.append(f"{artifact.path}: Artifact Role must be {role}")
    if field(artifact, "Owner Role") != expected_owner:
        errors.append(f"{artifact.path}: Owner Role must be {expected_owner}")
    if field(artifact, "Authored By Role") != expected_owner:
        errors.append(f"{artifact.path}: Authored By Role must be {expected_owner}")
    if field(artifact, "Status") != expected_status:
        errors.append(f"{artifact.path}: {role} Status must be {expected_status}")
    return errors


def validate_review_common(
    review: Artifact,
    expected_role: str,
    expected_reviewed_role: str,
    expected_lens: str,
    expected_permission: str,
) -> list[str]:
    errors: list[str] = []
    for duplicate in review.duplicate_fields:
        errors.append(f"{review.path}: duplicate header field '{duplicate}'")
    required = (
        "Artifact Role",
        "Owner Role",
        "Authored By Role",
        "Reviewed Artifact Role",
        "Artifact Lens",
        "Artifact Lens Status",
        "Content Review Status",
        "Content Review Rationale",
        "Verdict",
        "Downstream Permission",
        "Reviewed Path",
        "Authored Review Path",
        "Allowed Write Surface",
    )
    for name in missing_fields(review, required):
        errors.append(f"{review.path}: missing {name}")
    if field(review, "Artifact Role") != expected_role:
        errors.append(f"{review.path}: Artifact Role must be {expected_role}")
    if field(review, "Owner Role") != "Planning Review Coordinator":
        errors.append(f"{review.path}: Owner Role must be Planning Review Coordinator")
    if field(review, "Authored By Role") != "Planning Review Coordinator":
        errors.append(f"{review.path}: Authored By Role must be Planning Review Coordinator")
    for name in ("Owner", "Owner Role", "Authored By Role", "Reviewer Role", "Reviewer Artifact Authored By"):
        value = field(review, name)
        if value and has_main_role(value):
            errors.append(f"{review.path}: {name} must not name Main")
    if field(review, "Reviewed Artifact Role") != expected_reviewed_role:
        errors.append(f"{review.path}: Reviewed Artifact Role must be {expected_reviewed_role}")
    if field(review, "Artifact Lens") != expected_lens:
        errors.append(f"{review.path}: Artifact Lens must be {expected_lens}")
    if field(review, "Artifact Lens Status") != "Completed":
        errors.append(f"{review.path}: Artifact Lens Status must be Completed")
    if field_key(review, "Content Review Status") not in COMPLETED_CONTENT_STATUSES:
        errors.append(f"{review.path}: Content Review Status must be Completed or Not Required")
    if field(review, "Verdict") != "Accepted":
        errors.append(f"{review.path}: Verdict must be Accepted")
    if field(review, "Downstream Permission") != expected_permission:
        errors.append(f"{review.path}: Downstream Permission must be {expected_permission}")
    if not same_path(field(review, "Authored Review Path"), review.path):
        errors.append(f"{review.path}: Authored Review Path does not match file path")
    if not same_path(field(review, "Allowed Write Surface"), review.path):
        errors.append(f"{review.path}: Allowed Write Surface must match authored review path")
    return errors


def validate_cr_review(cr: Artifact, review_path: Path, expected_dir: Path) -> tuple[list[str], Artifact | None]:
    errors, review = load(review_path, expected_dir, "CR Review")
    if review is None:
        return errors, None
    errors.extend(
        validate_review_common(
            review,
            "CR Review",
            "CR",
            "lens-cr-artifact",
            "Roadmap creation may proceed",
        )
    )
    if not same_path(field(review, "Reviewed Path"), cr.path):
        errors.append(f"{review.path}: Reviewed Path does not match {cr.path}")
    return errors, review


def validate_plan_review(
    roadmap: Artifact,
    plan: Artifact,
    phase_paths: list[Path],
    review_path: Path,
    expected_dir: Path,
) -> tuple[list[str], Artifact | None]:
    errors, review = load(review_path, expected_dir, "Plan Review")
    if review is None:
        return errors, None
    errors.extend(
        validate_review_common(
            review,
            "Plan Review",
            "Planning Bundle",
            "lens-plan-artifact",
            "Implementation may proceed",
        )
    )
    required = ("Reviewed Roadmap Path", "Reviewed Phase Plan Paths", "Authorized Step Plan Paths")
    for name in missing_fields(review, required):
        errors.append(f"{review.path}: missing {name}")
    if not same_path(field(review, "Reviewed Path"), roadmap.path):
        errors.append(f"{review.path}: Reviewed Path does not match {roadmap.path}")
    if not same_path(field(review, "Reviewed Roadmap Path"), roadmap.path):
        errors.append(f"{review.path}: Reviewed Roadmap Path does not match {roadmap.path}")
    if not path_list_matches(field(review, "Reviewed Phase Plan Paths"), phase_paths):
        errors.append(f"{review.path}: Reviewed Phase Plan Paths does not match supplied phase plans")
    if not path_list_contains(field(review, "Authorized Step Plan Paths"), plan.path):
        errors.append(f"{review.path}: Authorized Step Plan Paths must include {plan.path}")
    return errors, review


def check_chain(
    cr_path: Path,
    plan_path: Path,
    phase_paths: list[Path] | None = None,
    expected_artifact_dir: Path | None = None,
) -> list[str]:
    phase_paths = phase_paths or []
    expected_dir = expected_artifact_dir or Path.cwd() / "build" / "agent-pass-logs"
    errors: list[str] = []

    cr_errors, cr = load(cr_path, expected_dir, "CR")
    plan_errors, plan = load(plan_path, expected_dir, "step plan")
    errors.extend(cr_errors)
    errors.extend(plan_errors)
    if cr is None or plan is None:
        return errors

    errors.extend(validate_primary(cr, "CR"))
    errors.extend(validate_primary(plan, "Step Plan"))

    parts = slug_parts(cr.path)
    if parts is None:
        errors.append(f"{cr.path}: CR filename does not match generated artifact pattern")
        date = slug = ""
    else:
        date, slug = parts
        if not path_matches_chain(plan.path, date, slug, "step"):
            errors.append(f"{plan.path}: step plan does not belong to CR chain {date}-{slug}")

    cr_review_errors, cr_review = validate_cr_review(cr, cr_review_path_for(cr.path), expected_dir)
    errors.extend(cr_review_errors)

    roadmap_path = roadmap_path_for(cr.path)
    roadmap = plan_review = None
    if roadmap_path is None:
        errors.append(f"{cr.path}: cannot derive roadmap path from CR filename")
    else:
        roadmap_errors, roadmap = load(roadmap_path, expected_dir, "roadmap")
        errors.extend(roadmap_errors)
        if roadmap is not None:
            errors.extend(validate_primary(roadmap, "Roadmap"))
            if date and slug and not path_matches_chain(roadmap.path, date, slug, "roadmap"):
                errors.append(f"{roadmap.path}: roadmap does not belong to CR chain {date}-{slug}")
            plan_review_path = plan_review_path_for(cr.path)
            if plan_review_path is None:
                errors.append(f"{cr.path}: cannot derive plan review path from CR filename")
            else:
                plan_review_errors, plan_review = validate_plan_review(
                    roadmap,
                    plan,
                    phase_paths,
                    plan_review_path,
                    expected_dir,
                )
                errors.extend(plan_review_errors)

    phase_artifacts: list[Artifact] = []
    for phase_path in phase_paths:
        phase_errors, phase = load(phase_path, expected_dir, "phase plan")
        errors.extend(phase_errors)
        if phase is None:
            continue
        phase_artifacts.append(phase)
        errors.extend(validate_primary(phase, "Phase Plan"))
        if date and slug and not path_matches_chain(phase.path, date, slug, "phase"):
            errors.append(f"{phase.path}: phase plan does not belong to CR chain {date}-{slug}")

    if uses_minimal_chain(cr, cr_review, roadmap, *phase_artifacts, plan, plan_review):
        errors.append("artifact chain uses unauthorized 'minimal chain' shortcut")
    return errors


def write(path: Path, text: str) -> None:
    path.write_text(text, encoding="utf-8")


def self_test() -> int:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)

        def build_case(name: str, options: dict[str, object]) -> tuple[Path, Path, list[Path]]:
            case_dir = root / name
            case_dir.mkdir()
            prefix = "2026-07-02-guard"
            cr = case_dir / f"{prefix}-cr.md"
            cr_review = case_dir / f"{prefix}-cr-review.md"
            roadmap = case_dir / f"{prefix}-roadmap.md"
            plan_review = case_dir / f"{prefix}-plan-review.md"
            old_step_review = case_dir / (f"{prefix}-wave-01-main-plan" + "-review.md")
            phase = case_dir / f"{prefix}-phase-01-plan.md"
            plan = case_dir / f"{prefix}-wave-01-main-plan.md"

            phase_required = bool(options.get("phase_required", False))
            minimal = "Minimal Chain: Used\n" if options.get("minimal", False) else ""
            write(
                cr,
                f"Artifact Role: CR\nOwner Role: Main/User\nAuthored By Role: Main/User\n"
                f"Status: Accepted\n{minimal}\n# CR\n",
            )
            review_owner = "Main" if options.get("main_review", False) else "Planning Review Coordinator"
            write_cr_review(cr, cr_review, review_owner)

            if not options.get("omit_roadmap", False):
                write(
                    roadmap,
                    "Artifact Role: Roadmap\nOwner Role: Planner\n"
                    "Authored By Role: Planner\nStatus: Accepted\n\n# Roadmap\n",
                )

            phases = []
            if phase_required:
                phases.append(phase)
                write(
                    phase,
                    "Artifact Role: Phase Plan\nOwner Role: Planner\n"
                    "Authored By Role: Planner\nStatus: Accepted\n\n# Phase\n",
                )

            write(
                plan,
                "Artifact Role: Step Plan\nOwner Role: Planner\n"
                "Authored By Role: Planner\nStatus: Accepted\n\n# Plan\n",
            )

            if options.get("legacy_step_review", False):
                write_step_review(plan, old_step_review)

            if not options.get("omit_plan_review", False):
                lens = "lens-cr-artifact" if options.get("wrong_lens", False) else "lens-plan-artifact"
                authorized_path = case_dir / f"{prefix}-wave-99-other-plan.md" if options.get("unauthorized_step", False) else plan
                if options.get("mixed_authorized_paths", False):
                    authorized = f"{plan}, relative-other-plan.md"
                elif options.get("relative_paths", False):
                    authorized = authorized_path.name
                else:
                    authorized = str(authorized_path)
                if not phases:
                    phase_field = "None"
                elif options.get("relative_paths", False):
                    phase_field = ", ".join(path.name for path in phases)
                else:
                    phase_field = ", ".join(str(path) for path in phases)
                write_plan_review(
                    roadmap,
                    plan_review,
                    lens,
                    authorized,
                    phase_field,
                    review_owner,
                    omit_paths=bool(options.get("omit_review_paths", False)),
                    omit_rationale=bool(options.get("omit_content_rationale", False)),
                )
            return cr, plan, phases

        def write_cr_review(reviewed: Path, review: Path, owner_role: str) -> None:
            write(
                review,
                f"Artifact Role: CR Review\nOwner Role: {owner_role}\n"
                f"Authored By Role: {owner_role}\nReviewed Artifact Role: CR\n"
                "Artifact Lens: lens-cr-artifact\nArtifact Lens Status: Completed\n"
                "Content Review Status: Completed\n"
                "Content Review Rationale: reviewed by selected content lenses\n"
                "Verdict: Accepted\nDownstream Permission: Roadmap creation may proceed\n"
                f"Reviewed Path: {reviewed}\nAuthored Review Path: {review}\n"
                f"Allowed Write Surface: {review}\n\n# Review\n",
            )

        def write_plan_review(
            roadmap: Path,
            review: Path,
            lens: str,
            authorized_steps: str,
            phases: str,
            owner_role: str,
            omit_paths: bool = False,
            omit_rationale: bool = False,
        ) -> None:
            roadmap_field = roadmap.name if "relative-path-fields" in str(review) else str(roadmap)
            review_field = review.name if "relative-path-fields" in str(review) else str(review)
            path_fields = "" if omit_paths else (
                f"Reviewed Path: {roadmap_field}\n"
                f"Authored Review Path: {review_field}\n"
                f"Allowed Write Surface: {review_field}\n"
                f"Reviewed Roadmap Path: {roadmap_field}\n"
                f"Reviewed Phase Plan Paths: {phases}\n"
                f"Authorized Step Plan Paths: {authorized_steps}\n"
            )
            rationale = "" if omit_rationale else "Content Review Rationale: reviewed by selected content lenses\n"
            write(
                review,
                "Artifact Role: Plan Review\n"
                f"Owner Role: {owner_role}\nAuthored By Role: {owner_role}\n"
                "Reviewed Artifact Role: Planning Bundle\n"
                f"Artifact Lens: {lens}\nArtifact Lens Status: Completed\n"
                "Content Review Status: Completed\n"
                f"{rationale}"
                "Verdict: Accepted\nDownstream Permission: Implementation may proceed\n"
                f"{path_fields}\n# Review\n",
            )

        def write_step_review(reviewed: Path, review: Path) -> None:
            write(
                review,
                f"Reviewed Path: {reviewed}\nAuthored Review Path: {review}\n"
                "Verdict: Accepted\n\n# Legacy Separate Review\n",
            )

        cases = [
            ("valid-bundle", {}, ()),
            ("valid-bundle-with-phase", {"phase_required": True}, ()),
            ("main-owned-review", {"main_review": True}, ("Owner Role must be Planning Review Coordinator",)),
            ("missing-plan-review", {"omit_plan_review": True}, ("missing Plan Review artifact",)),
            ("unauthorized-step", {"unauthorized_step": True}, ("Authorized Step Plan Paths must include",)),
            ("wrong-lens", {"wrong_lens": True}, ("Artifact Lens must be lens-plan-artifact",)),
            (
                "legacy-step-review-only",
                {"omit_plan_review": True, "legacy_step_review": True},
                ("missing Plan Review artifact",),
            ),
            (
                "missing-review-path-fields",
                {"omit_review_paths": True},
                (
                    "missing Reviewed Path",
                    "missing Authored Review Path",
                    "missing Allowed Write Surface",
                    "missing Reviewed Roadmap Path",
                    "missing Reviewed Phase Plan Paths",
                    "missing Authorized Step Plan Paths",
                ),
            ),
            ("missing-content-review-rationale", {"omit_content_rationale": True}, ("missing Content Review Rationale",)),
            (
                "relative-path-fields",
                {"relative_paths": True, "phase_required": True},
                (
                    "Reviewed Path does not match",
                    "Authored Review Path does not match file path",
                    "Allowed Write Surface must match authored review path",
                    "Reviewed Roadmap Path does not match",
                    "Reviewed Phase Plan Paths does not match supplied phase plans",
                    "Authorized Step Plan Paths must include",
                ),
            ),
            (
                "mixed-authorized-path-fields",
                {"mixed_authorized_paths": True},
                ("Authorized Step Plan Paths must include",),
            ),
            ("missing-roadmap", {"omit_roadmap": True}, ("missing roadmap artifact",)),
            ("unauthorized-minimal-chain", {"minimal": True}, ("unauthorized 'minimal chain' shortcut",)),
        ]

        failures: list[str] = []
        for name, options, expected_fragments in cases:
            case_cr, case_plan, phase_plans = build_case(name, options)
            errors = check_chain(case_cr, case_plan, phase_plans, case_cr.parent)
            missing = [fragment for fragment in expected_fragments if not any(fragment in err for err in errors)]
            if missing:
                failures.append(f"{name}: missing diagnostics {missing}, got {errors}")
            if not expected_fragments and errors:
                failures.append(f"{name}: expected pass, got {errors}")
        if failures:
            print("Artifact chain guard self-test: FAIL")
            for failure in failures:
                print(failure)
            return 1
        print("Artifact chain guard self-test: PASS")
        return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cr", type=Path)
    parser.add_argument("--plan", type=Path)
    parser.add_argument("--phase-plan", action="append", type=Path, default=[])
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()

    if args.self_test:
        return self_test()
    if args.cr is None or args.plan is None:
        parser.error("--cr and --plan are required unless --self-test is used")

    errors = check_chain(args.cr, args.plan, args.phase_plan)
    if errors:
        print("Artifact chain guard: FAIL")
        for error in errors:
            print(f"- {error}")
        return 1
    print("Artifact chain guard: PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
