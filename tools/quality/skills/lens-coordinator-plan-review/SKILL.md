---
name: lens-coordinator-plan-review
description: Use inside a SaltMarcher Plan Review Coordinator. Selects lens-plan-artifact plus risk-based content lenses, briefs reviewers through coord-planning-reviewer, and authors exactly one planning-bundle review artifact.
---

# Lens: Plan Review Coordinator

## Role

Use this skill only inside the coordinator subagent for planning-bundle review.
Mandatory skills, in order:

- `/home/aaron/.codex/skills/local/lens-adversarial-review-agent/SKILL.md`
- `/home/aaron/.codex/skills/local/lens-coordinator/SKILL.md`

The coordinator establishes reviewability, performs a neutral evidence pass,
launches `lens-plan-artifact` and any risk-selected content lenses through
`coord-planning-reviewer`, then authors only the assigned plan-review artifact.
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
dependency, proof, onboarding, or residual-risk questions. A selected content
reviewer that only checks formal fields is incomplete.

## Review Artifact

Write only the assigned `*-plan-review.md`. It must start with:

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

## References

- [Plan Artifact Lens](../lens-plan-artifact/SKILL.md)
- [Planning Reviewer Briefing](../coord-planning-reviewer/SKILL.md)
- [Implementation Artifacts Standard](../../../../docs/project/architecture/implementation-artifacts.md)
