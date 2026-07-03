---
name: coord-main-implementation-review
description: Use by Main before launching a SaltMarcher Implementation Review Coordinator after implementation logs and Verification Runner proof exist. Defines neutral launch packet, proof freshness, required qualitative packet, and blocked fallback.
---

# Coordination: Main To Implementation Review

## Role

Use this caller-side skill after implementation logs exist and the assigned
Verification Runner has produced final integrated proof or an exact blocker.

Main launches exactly one clean Implementation Review Coordinator. Main must
not launch specialist reviewers directly, write reviewer outputs, self-review,
or substitute final proof.

## Launch Packet

The coordinator prompt must name:

- required skills, in order:
  `/home/aaron/.codex/skills/local/lens-adversarial-review-agent/SKILL.md`,
  `/home/aaron/.codex/skills/local/coord-adversarial-review/SKILL.md`,
  `/home/aaron/.codex/skills/local/lens-coordinator/SKILL.md`, and
  `tools/quality/skills/lens-coordinator-implementation-review/SKILL.md`
- accepted wave/step plan and plan-review paths
- implementation log paths and changed paths
- Verification Runner command results, blockers, log paths, and freshness
- dirty baseline and unrelated paths
- owner evidence and mandatory skills for the touched surface
- required qualitative `code-simplifier` packet path or fallback instruction
  to read the installed plugin skill directly when auto-discovery is missing
- required output from the coordinator: one coordinator result
- assigned review-log path that Main will aggregate after coordinator output
- allowed write surface for the coordinator: reviewer outputs, qualitative
  packet evidence, and explicitly assigned scoped-fix write sets only; not the
  aggregated review log
- exact local start time and expected first-poll time for launched review roles

## Required Behavior

The coordinator owns reviewability, qualitative packet routing, risk-selected
specialist review, scoped fix-worker routing, proof-staleness handling, and
final clean/WIP/blocked status. If coordinator tooling, required reviewer
launch, or the qualitative packet is unavailable, return WIP/blocked. Main must
not collapse the panel into self-review.

If any coordinator-requested fix changes tracked files, the coordinator returns
`Proof Refresh Required` and waits for fresh Verification Runner evidence
before final aggregation.

## Handoff

The coordinator returns review evidence and final status; Main writes the
aggregated review log only from the coordinator's accepted output. The pass is
not handoff-ready until the review log records fresh Verification Runner proof,
qualitative packet disposition, selected reviewer outcomes, fixes,
project-health/baseline admission, and final status.

## References

- [Implementation Review Coordinator](../lens-coordinator-implementation-review/SKILL.md)
- [Verification Runner](../verification-runner/SKILL.md)
- [Implementation Artifacts Standard](../../../../docs/project/architecture/implementation-artifacts.md)
