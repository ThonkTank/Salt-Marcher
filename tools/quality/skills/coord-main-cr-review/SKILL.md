---
name: coord-main-cr-review
description: Use by Main before launching a SaltMarcher CR Review Coordinator. Assigns one CR review artifact path, neutral evidence packet, allowed write surface, and blocked fallback when the coordinator cannot run.
---

# Coordination: Main To CR Review

## Role

Use this caller-side skill before launching a CR Review Coordinator. CR review
is a pre-roadmap gate. It grants or denies downstream permission to create the
roadmap; it does not review a planning bundle or implementation result.
The split CR Review Coordinator route does not change guard-readable artifact
role values; generated CR review headers use the shared
`Planning Review Coordinator` role required by the artifact-chain guard.

Main launches exactly one clean coordinator using:

1. `/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/lens-adversarial-review-agent/SKILL.md`
2. `/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/lens-coordinator/SKILL.md`
3. `tools/quality/skills/lens-coordinator-cr-review/SKILL.md`
4. `tools/quality/skills/coord-planning-reviewer/SKILL.md` before reviewers

## Launch Packet

Provide only neutral, inspectable facts:

- reviewed CR path
- input authority: the CR path under review
- required output artifact path: exactly one canonical CR review path,
  `YYYY-MM-DD-<slug>-cr-review.md`, derived from the CR path
- allowed write surface: exactly that CR review artifact path plus the reviewed
  CR's guard-readable status/upkeep fields
- current dirty-path boundary and unrelated work
- owner documents and mandatory skills needed to judge the CR
- local source evidence and proof snippets the CR relies on
- user constraints, non-goals, and unresolved unknowns
- Initial Concern Hints as hints only, not reviewer prompts or expected
  findings

Main assigns the review path and narrow CR status/upkeep surface before launch
but must not write or replace them. If the path or allowed write surface is
missing, or if the coordinator or required reviewer launch is unavailable, the
CR remains WIP/blocked; Main must not self-review, invent a review path,
synthesize acceptance, or patch the CR status after review.

## Handoff

Before roadmap planning proceeds, the generated review artifact must exist at
the assigned path and show:

- `Artifact Role: CR Review`
- `Owner Role: Planning Review Coordinator`
- `Authored By Role: Planning Review Coordinator`
- completed `lens-cr-artifact`
- a valid verdict
- downstream permission `Roadmap creation may proceed` when accepted
- the reviewed CR's `Status`, `Status Authority Role`, and
  `Status Authority Path` synchronized to the coordinator verdict

Pure CR-review form errors, such as a missing guard-readable header field or
status-authority field whose value is fixed by the artifact contract, may be
sent back to the CR Review Coordinator for direct mechanical repair. Do not
start a planner or content re-review for that form repair unless the correction
would change CR intent, verdict, permission, scope, or reviewer judgment.

## References

- [CR Review Coordinator](../lens-coordinator-cr-review/SKILL.md)
- [Planning Reviewer Briefing](../coord-planning-reviewer/SKILL.md)
- [Implementation Artifacts Standard](../../../../docs/project/architecture/implementation-artifacts.md)
