---
name: coord-main-implementation-review
description: Use by Main before launching a SaltMarcher Implementation Review Coordinator after implementation logs and Verification Runner proof exist. Defines neutral launch packet, proof freshness, review-log write surface, and blocked fallback.
---

# Coordination: Main To Implementation Review

## Role

Use this caller-side skill after implementation logs exist and the assigned
Verification Runner has produced final integrated proof or an exact blocker.

Main launches exactly one clean Implementation Review Coordinator. Main must
not launch specialist reviewers directly, write reviewer outputs, write the
review log, self-review, or substitute final proof.

## Launch Packet

The coordinator prompt must name:

- required skills, in order:
  `/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/lens-adversarial-review-agent/SKILL.md`,
  `/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/coord-adversarial-review/SKILL.md`,
  `/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/lens-coordinator/SKILL.md`, and
  `tools/quality/skills/lens-coordinator-implementation-review/SKILL.md`
- accepted wave/step plan and plan-review paths
- implementation log paths and changed paths
- Verification Runner command results, blockers, log paths, and freshness
- dirty baseline and unrelated paths
- owner evidence and mandatory skills for the touched surface
- Initial Concern Hints as hints only, not reviewer prompts, expected
  findings, or acceptance criteria
- required output from the coordinator: the assigned review log and one
  coordinator result
- assigned review-log path that the coordinator must write
- allowed write surface for the coordinator: exactly the assigned review log,
  reviewer-output locations when applicable, and explicitly assigned scoped-fix
  write sets only
- exact local start time and expected first-poll time for launched review roles

## Required Behavior

The coordinator owns reviewability, qualitative implementation review,
risk-selected specialist review, repair-gate classification, trivial
fix-worker routing, proof-staleness handling, review-log writing, and final
clean/WIP/blocked status. If coordinator tooling or required reviewer launch
is unavailable, return WIP/blocked. Main must not collapse the panel into
self-review or write the review log as a fallback.

Direct review fixes are limited to coordinator-classified `Trivial Mechanical
Fix` findings. When the coordinator returns `WIP - Planner Repair Required`,
Main must launch the repo-owned planner with the neutral finding packet and must
not apply a direct fix, self-review, or shortened proof-refresh loop.

Review-log form errors are a narrower mechanical artifact repair path. If the
assigned review log is missing only required fields whose values are fixed by
the coordinator's existing evidence, reviewer outputs, Verification Runner
result, and unchanged final status, Main may route the log back to the
Implementation Review Coordinator for direct form repair. Do not start a new
planner or implementation re-review for that form repair unless the correction
would change a finding, verdict, proof-freshness judgment, baseline admission,
or objective-completion result.

If any coordinator-requested fix changes tracked files, the coordinator returns
`Proof Refresh Required` and waits for fresh Verification Runner evidence
before final aggregation.

## Handoff

The coordinator writes the assigned review log and returns review evidence plus
final status. The pass is not handoff-ready until the review log records fresh
Verification Runner proof, qualitative review disposition, selected reviewer
outcomes, fixes, project-health/baseline admission, and final status.

## References

- [Implementation Review Coordinator](../lens-coordinator-implementation-review/SKILL.md)
- [Verification Runner](../verification-runner/SKILL.md)
- [Implementation Artifacts Standard](../../../../docs/project/architecture/implementation-artifacts.md)
