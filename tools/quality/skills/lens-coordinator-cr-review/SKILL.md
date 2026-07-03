---
name: lens-coordinator-cr-review
description: Use inside a SaltMarcher CR Review Coordinator. Selects lens-cr-artifact plus risk-based content lenses, briefs reviewers through coord-planning-reviewer, and authors exactly one CR review artifact.
---

# Lens: CR Review Coordinator

## Role

Use this skill only inside the coordinator subagent for CR review. Mandatory
skills, in order:

- `/home/aaron/.codex/skills/local/lens-adversarial-review-agent/SKILL.md`
- `/home/aaron/.codex/skills/local/lens-coordinator/SKILL.md`

This skill adds CR-review behavior only. The coordinator establishes
reviewability, performs a neutral evidence pass, launches `lens-cr-artifact`
and any risk-selected content lenses through `coord-planning-reviewer`, then
authors only the assigned CR review artifact.
The coordinator route is CR-specific, but the generated artifact keeps the
shared guard-readable `Planning Review Coordinator` value in `Owner Role` and
`Authored By Role`.

## Reviewability

Return `Not Reviewable Yet` for missing CR, ambiguous dirty baseline, missing
owner evidence, missing source evidence the CR relies on, stale baseline
claims, or unresolved prior reviewer findings. Name the smallest correction
needed before a fresh pass.

## Evidence And Panel

Inspect the CR's wrong state, target state, rationale, non-goals, owner
surfaces, acceptance criteria, and Done When against the current baseline.
Classify Main hints as hints only. Derive 3-7 falsifiable CR risk propositions
before selecting content lenses.

Always launch `tools/quality/skills/lens-cr-artifact/SKILL.md` as a separate
reviewer. Select global content lenses only for concrete CR risk. If selected
content reviewers cannot answer coordinator-derived risk propositions with
specialist evidence, return `Blocked` or rebrief them.

## Review Artifact

The caller must assign exactly one CR review artifact path as this
coordinator's allowed write surface. If that assignment is missing or broader
than the review artifact, return `Not Reviewable Yet`.

Write only the assigned `*-cr-review.md`. It must start with:

- `Artifact Role: CR Review`
- `Owner Role: Planning Review Coordinator`
- `Authored By Role: Planning Review Coordinator`
- `Reviewed Artifact Role: CR`
- `Artifact Lens: lens-cr-artifact`
- `Artifact Lens Status: Completed`
- `Content Review Status: Completed` or `Not Required`
- `Content Review Rationale: <free prose>`
- `Verdict: Accepted`, `Rework Required`, or `Blocked`
- `Downstream Permission: Roadmap creation may proceed` when accepted
- `Reviewed Path`, `Authored Review Path`, and `Allowed Write Surface`

After the header, include coordinator evidence, CR target claims, risk
propositions, content-lens briefings, rejected formal-only frames, findings, and
residual risk.

## References

- [CR Artifact Lens](../lens-cr-artifact/SKILL.md)
- [Planning Reviewer Briefing](../coord-planning-reviewer/SKILL.md)
- [Implementation Artifacts Standard](../../../../docs/project/architecture/implementation-artifacts.md)
