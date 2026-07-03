---
name: lens-coordinator-implementation-review
description: Use inside a SaltMarcher Implementation Review Coordinator after implementation logs and Verification Runner evidence exist. Runs qualitative implementation review, writes the assigned review log, coordinates handoff review, fix loops, proof freshness, and final status.
---

# Lens: Implementation Review Coordinator

## Role

Use this skill only inside an Implementation Review Coordinator. Mandatory
skills, in order:

- `/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/lens-adversarial-review-agent/SKILL.md`
- `/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/coord-adversarial-review/SKILL.md`
- `/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/lens-coordinator/SKILL.md`

This skill adds SaltMarcher implementation-review behavior. It reuses the
repo-owned handoff coordinator and reviewer-briefing stack as method evidence; it
does not fork repo-owned specialist lenses.

## Reviewability

Return `Not Reviewable Yet` for missing implementation logs, missing accepted
plan authority, missing or stale Verification Runner proof, ambiguous dirty
baseline, missing owner evidence, missing review-log destination, or unclear
coordinator output assignment. Return `Blocked` when required reviewer tooling
cannot run.

## Evidence Pass

Inspect the accepted plan, implementation logs, changed paths, dirty baseline,
owner docs and skills, project-health evidence, Verification Runner proof, and
prior findings. Derive 3-7 falsifiable handoff claims about objective
completion, proof freshness, baseline admission, architecture/quality fit,
debt disposition, and residual risk.

## Qualitative Review And Panel

Treat simplicity, elegance, smells, coupling, indirection, performance,
maintainability, and project-health disposition as built-in implementation
review concerns. Cover them in the coordinator evidence pass and through
risk-selected repo-owned lenses when a concrete handoff risk needs specialist
judgment. Do not launch a standalone simplifier agent or require an external
qualitative review artifact.

Select specialist lenses by concrete handoff risk and brief them through the
repo-owned reviewer-briefing method. Specialist reviewers remain read-only.

## Repair Gate

Before any fix routing, classify each blocking finding as `Trivial Mechanical
Fix` or `Planner Repair Required`. `Trivial Mechanical Fix` requires exactly
one obvious correction and no accepted-plan decision change, owner,
architecture, code-health, proof, harness, PMD, API, state, shape, or
target-model concern; examples include a missed bracket, obvious typo, stale
link, or clearly unused accessor/import.

All other blockers are `Planner Repair Required`, including code-health,
code-shape, PMD or quality-rule, simplicity, smell, coupling,
indirection, ownership, harness/gate mismatch, repeated-fix, proof-oracle, and
multi-repair findings. Return `WIP - Planner Repair Required` with a neutral
planner packet instead of a fix-worker brief. Scoped fix workers may edit only
explicitly assigned write sets for findings classified as
`Trivial Mechanical Fix`.

## Proof Freshness

Review layers inspect Verification Runner evidence and report missing or stale
proof. They do not rerun final proof commands. If the coordinator, specialist
reviewer, or trivial scoped fix worker changes tracked files or requires
file-changing fixes, return `Proof Refresh Required`; wait for Main to launch a
fresh Verification Runner before final status.

## Output

Write the assigned review log and return one coordinator result. Do not write
outside the assigned review-log path, reviewer-output locations when
applicable, or explicitly assigned scoped-fix write sets.

The coordinator result must include:

- reviewability and evidence checked
- changed/reviewed scope
- coordinator-derived handoff claims
- qualitative review outcome
- selected panel, skipped lenses, and reviewer outcomes
- findings, fixes, proof-refresh requests, and stale findings
- project-health and baseline-admission disposition
- final status: `Clean`, `WIP - Objective Not Satisfied`,
  `WIP - Debt Materialization Required`, `WIP - Must Fix Before Handoff`,
  `WIP - Planner Repair Required`, `WIP - Review Panel Blocked`,
  `WIP - Verification Blocked`, or `Proof Refresh Required`

If this coordinator later receives a direct mechanical form-repair request for
its assigned review log, repair only missing or malformed log fields whose
values are already fixed by the accepted plan, implementation log, reviewer
outputs, Verification Runner evidence, and unchanged coordinator result. Do not
change the final status, findings, proof-freshness judgment, baseline
admission, objective-completion verdict, or specialist-review outcome through
the form-repair path.

## References

- [Main To Implementation Review](../coord-main-implementation-review/SKILL.md)
- [Verification Runner](../verification-runner/SKILL.md)
- [Coordinator Lens](/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/lens-coordinator/SKILL.md)
- [Overview Reviewer Briefing](/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/coord-overview-reviewer/SKILL.md)
- [Handoff Coordinator Lens](/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/lens-coordinator-handoff/SKILL.md)
