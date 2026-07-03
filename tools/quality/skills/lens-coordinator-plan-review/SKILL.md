---
name: lens-coordinator-plan-review
description: Use inside a SaltMarcher Plan Review Coordinator. Selects lens-plan-artifact plus risk-based content lenses, briefs reviewers through coord-planning-reviewer, and authors exactly one planning-bundle review artifact.
---

# Lens: Plan Review Coordinator

## Role

Use this skill only inside the coordinator subagent for planning-bundle review.
Mandatory skills, in order:

- `/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/lens-adversarial-review-agent/SKILL.md`
- `/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/lens-coordinator/SKILL.md`

The coordinator establishes reviewability, performs a neutral evidence pass,
launches `lens-plan-artifact` and any risk-selected content lenses through
`coord-planning-reviewer`, then authors the assigned plan-review artifact and
updates reviewed planning-bundle guard-readable status/upkeep fields.
The coordinator route is plan-specific, but the generated artifact keeps the
shared guard-readable `Planning Review Coordinator` value in `Owner Role` and
`Authored By Role`.

## Reviewability

Return `Not Reviewable Yet` for missing accepted CR or CR review, missing
roadmap/phase/step artifacts, ambiguous dirty baseline, missing owner evidence,
stale planning evidence, or unresolved prior reviewer findings. Name the
smallest correction needed before a fresh pass.

## Evidence And Panel

Inspect accepted CR goals against roadmap decisions, target-state quality,
rejected alternatives, phase and step decomposition, proof route, review route,
and implementation authority claims. Derive 3-7 falsifiable planning risk
propositions before selecting content lenses.

Always launch `tools/quality/skills/lens-plan-artifact/SKILL.md` as a separate
reviewer. Select content lenses for concrete target-fit, architecture, quality,
dependency, proof, onboarding, or residual-risk concerns. A selected content
reviewer that only checks formal fields is incomplete.

## Review Artifact

The caller must assign exactly one plan-review artifact path plus the reviewed
roadmap, reviewed phase-plan, and authorized step-plan guard-readable
status/upkeep fields as this coordinator's allowed write surface. The path must
be the canonical `YYYY-MM-DD-<slug>-plan-review.md` derived from the accepted
CR path. If that assignment is missing, noncanonical, or broader than those
surfaces, return
`Not Reviewable Yet`.

Write only the assigned `*-plan-review.md` and the reviewed planning-bundle
mechanical status/upkeep header fields. The review artifact must start with:

- `Artifact Role: Plan Review`
- `Owner Role: Planning Review Coordinator`
- `Authored By Role: Planning Review Coordinator`
- `Reviewed Artifact Role: Planning Bundle`
- `Artifact Lens: lens-plan-artifact`
- `Artifact Lens Status: Completed`
- `Content Review Status: Completed` or `Not Required`
- `Content Review Rationale: <free prose>`
- `Verdict: Accepted`, `Rework Required`, or `Blocked`
- `Downstream Permission: Implementation may proceed` when accepted
- `Reviewed Path`, `Authored Review Path`, and `Allowed Write Surface`
- `Reviewed Roadmap Path`
- `Reviewed Phase Plan Paths`
- `Authorized Step Plan Paths`

After the header, include coordinator evidence, CR goals versus plan claims,
risk propositions, content-lens briefings, rejected formal-only frames,
findings, and residual risk.

Synchronize reviewed planning-bundle status in the same pass for the reviewed
roadmap, every reviewed phase plan, and every authorized step plan:

- `Verdict: Accepted` -> `Status: Accepted`
- `Verdict: Rework Required` -> `Status: Rework Required`
- `Verdict: Blocked` -> `Status: Blocked`

Also write `Status Authority Role: Planning Review Coordinator` and
`Status Authority Path: <this plan-review artifact path>` on each synchronized
artifact. Do not rewrite roadmap strategy, phase content, step write sets,
proof routes, implementation steps, or other substantive planning content.

If this coordinator later receives a direct mechanical form-repair request for
its own plan review artifact or assigned planning-bundle status/upkeep fields,
repair only the guard-readable form fields whose correct values are fixed by
the artifact contract or `verify_artifact_chain.py --print-contract`. Do not
change the verdict, downstream permission, authorized step-plan set, reviewed
scope, findings, or content-lens judgment through the form-repair path.

## References

- [Plan Artifact Lens](../lens-plan-artifact/SKILL.md)
- [Planning Reviewer Briefing](../coord-planning-reviewer/SKILL.md)
- [Implementation Artifacts Standard](../../../../docs/project/architecture/implementation-artifacts.md)
