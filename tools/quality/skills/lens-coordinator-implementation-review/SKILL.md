---
name: lens-coordinator-implementation-review
description: Use inside a SaltMarcher Implementation Review Coordinator after implementation logs and Verification Runner evidence exist. Aggregates the qualitative code-simplifier packet, global handoff review stack, fix loops, proof freshness, and final status.
---

# Lens: Implementation Review Coordinator

## Role

Use this skill only inside an Implementation Review Coordinator. Mandatory
skills, in order:

- `/home/aaron/.codex/skills/local/lens-adversarial-review-agent/SKILL.md`
- `/home/aaron/.codex/skills/local/coord-adversarial-review/SKILL.md`
- `/home/aaron/.codex/skills/local/lens-coordinator/SKILL.md`

This skill adds SaltMarcher implementation-review behavior. It reuses the
global handoff coordinator and reviewer-briefing stack as method evidence; it
does not fork global specialist lenses.

## Reviewability

Return `Not Reviewable Yet` for missing implementation logs, missing accepted
plan authority, missing or stale Verification Runner proof, ambiguous dirty
baseline, missing owner evidence, missing review-log destination, or unclear
coordinator output assignment. Return `Blocked` when required reviewer tooling
or the qualitative packet cannot run.

## Evidence Pass

Inspect the accepted plan, implementation logs, changed paths, dirty baseline,
owner docs and skills, project-health evidence, Verification Runner proof, and
prior findings. Derive 3-7 falsifiable handoff claims about objective
completion, proof freshness, baseline admission, architecture/quality fit,
debt disposition, and residual risk.

## Required Packet And Panel

Include the installed `code-simplifier` skill as a required qualitative packet.
If auto-discovery fails, read
`/home/aaron/.codex/plugins/cache/claude-plugins-official/code-simplifier/1.0.0/agents/code-simplifier.md`
directly. Treat its supported findings as same-run review findings, not as a
separate Main-owned phase.

Select specialist lenses by concrete handoff risk and brief them through the
global reviewer-briefing method. Specialist reviewers remain read-only.

## Repair Gate

Before any fix routing, classify each blocking finding as `Trivial Mechanical
Fix` or `Planner Repair Required`. `Trivial Mechanical Fix` requires exactly
one obvious correction and no accepted-plan decision change, owner,
architecture, code-health, proof, harness, PMD, API, state, shape, or
target-model concern; examples include a missed bracket, obvious typo, stale
link, or clearly unused accessor/import.

All other blockers are `Planner Repair Required`, including code-health,
code-shape, PMD or quality-rule, `code-simplifier`, smell, coupling,
indirection, ownership, harness/gate mismatch, repeated-fix, proof-oracle, and
multi-repair findings. Return `WIP - Planner Repair Required` with a neutral
planner packet instead of a fix-worker brief. Scoped fix workers may edit only
explicitly assigned write sets for findings classified as
`Trivial Mechanical Fix`.

## Proof Freshness

Review layers inspect Verification Runner evidence and report missing or stale
proof. They do not rerun final proof commands. If the coordinator, qualitative
packet, specialist reviewer, or trivial scoped fix worker changes tracked files
or requires file-changing fixes, return `Proof Refresh Required`; wait for Main
to launch a fresh Verification Runner before final status.

## Output

Return one coordinator result for Main to aggregate. Do not write the
aggregated review log; Main owns that artifact after accepting the coordinator
result.

The coordinator result must include:

- reviewability and evidence checked
- changed/reviewed scope
- coordinator-derived handoff claims
- qualitative packet outcome
- selected panel, skipped lenses, and reviewer outcomes
- findings, fixes, proof-refresh requests, and stale findings
- project-health and baseline-admission disposition
- final status: `Clean`, `WIP - Objective Not Satisfied`,
  `WIP - Debt Materialization Required`, `WIP - Must Fix Before Handoff`,
  `WIP - Planner Repair Required`, `WIP - Review Panel Blocked`,
  `WIP - Verification Blocked`, or `Proof Refresh Required`

## References

- [Main To Implementation Review](../coord-main-implementation-review/SKILL.md)
- [Verification Runner](../verification-runner/SKILL.md)
- [Global Coordinator Lens](/home/aaron/.codex/skills/local/lens-coordinator/SKILL.md)
- [Global Overview Reviewer Briefing](/home/aaron/.codex/skills/local/coord-overview-reviewer/SKILL.md)
- [Global Handoff Coordinator Lens](/home/aaron/.codex/skills/local/lens-coordinator-handoff/SKILL.md)
