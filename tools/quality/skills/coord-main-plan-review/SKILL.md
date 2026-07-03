---
name: coord-main-plan-review
description: Use by Main before launching a SaltMarcher Plan Review Coordinator for one roadmap, phase-plan, and step-plan bundle. Assigns the plan-review artifact path and blocks when the coordinator cannot run.
---

# Coordination: Main To Plan Review

## Role

Use this caller-side skill before launching a Plan Review Coordinator for a
planning bundle. The bundle is the planner-authored roadmap, any required phase
plans, and implementation-ready wave/step plans authorized for possible
implementation.
The split Plan Review Coordinator route does not change guard-readable artifact
role values; generated plan-review headers use the shared
`Planning Review Coordinator` role required by the artifact-chain guard.

Main launches exactly one clean coordinator using:

1. `/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/lens-adversarial-review-agent/SKILL.md`
2. `/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/lens-coordinator/SKILL.md`
3. `tools/quality/skills/lens-coordinator-plan-review/SKILL.md`
4. `tools/quality/skills/coord-planning-reviewer/SKILL.md` before reviewers

## Launch Packet

Provide only neutral, inspectable facts:

- accepted CR and CR review paths
- roadmap, phase-plan, and step-plan paths under review
- input authority: accepted CR review plus the planning bundle under review
- required output artifact path: exactly one canonical plan-review path,
  `YYYY-MM-DD-<slug>-plan-review.md`, derived from the CR path
- allowed write surface: exactly that plan-review artifact path plus
  guard-readable status/upkeep fields in the reviewed roadmap, phase plans,
  and authorized step plans
- dirty baseline boundary and unrelated work
- owner documents, mandatory skills, proof snippets, source evidence, and
  unresolved unknowns needed to judge the bundle
- Initial Concern Hints as hints only

Main assigns the review path and narrow planning-bundle status/upkeep surface
before launch and must not write or replace them. If the path or allowed write
surface is missing, or if the coordinator or required reviewer launch is
unavailable, the bundle remains WIP/blocked; Main must not self-review, invent
a review path, synthesize implementation permission, or patch plan statuses
after review.

## Handoff

Before implementation proceeds, the generated review artifact must exist at the
assigned path and show:

- `Artifact Role: Plan Review`
- `Owner Role: Planning Review Coordinator`
- `Authored By Role: Planning Review Coordinator`
- completed `lens-plan-artifact`
- accepted downstream permission
- the authorized step-plan paths
- reviewed roadmap/phase/step `Status`, `Status Authority Role`, and
  `Status Authority Path` synchronized to the coordinator verdict

Pure plan-review form errors, such as a noncanonical `*-plan-review-r2.md`
acceptance wrapper, wrong guard-readable header name, missing status authority
field, or exact `Allowed Write Surface` mismatch, may be sent back to the Plan
Review Coordinator for direct mechanical repair. Do not start a new planner or
content re-review unless the correction would change plan content, authorized
step plans, scope, downstream permission, verdict, or reviewer judgment.

## References

- [Plan Review Coordinator](../lens-coordinator-plan-review/SKILL.md)
- [Planning Reviewer Briefing](../coord-planning-reviewer/SKILL.md)
- [Implementation Artifacts Standard](../../../../docs/project/architecture/implementation-artifacts.md)
