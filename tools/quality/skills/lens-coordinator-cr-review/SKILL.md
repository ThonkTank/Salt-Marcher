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
authors the assigned CR review artifact and updates the reviewed CR's
guard-readable status/upkeep fields.
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

The caller must assign exactly one CR review artifact path plus the reviewed
CR's guard-readable status/upkeep fields as this coordinator's allowed write
surface. The path must be the canonical `YYYY-MM-DD-<slug>-cr-review.md`
derived from the reviewed CR path. If that assignment is missing,
noncanonical, or broader than those surfaces, return `Not Reviewable Yet`.

Write only the assigned `*-cr-review.md` and the reviewed CR's mechanical
status/upkeep header fields. The review artifact must start with:

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

Synchronize the reviewed CR status in the same pass:

- `Verdict: Accepted` -> CR `Status: Accepted`
- `Verdict: Rework Required` -> CR `Status: Rework Required`
- `Verdict: Blocked` -> CR `Status: Blocked`

Also write CR `Status Authority Role: Planning Review Coordinator` and
`Status Authority Path: <this CR review artifact path>`. Do not rewrite CR
intent, target state, acceptance criteria, or other substantive CR content.

If this coordinator later receives a direct mechanical form-repair request for
its own CR review artifact or assigned CR status/upkeep fields, repair only the
guard-readable form fields whose correct values are fixed by the artifact
contract. Do not change the verdict, downstream permission, CR intent, findings,
or content-lens judgment through the form-repair path.

## References

- [CR Artifact Lens](../lens-cr-artifact/SKILL.md)
- [Planning Reviewer Briefing](../coord-planning-reviewer/SKILL.md)
- [Implementation Artifacts Standard](../../../../docs/project/architecture/implementation-artifacts.md)
