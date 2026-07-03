---
name: lens-coordinator
description: "Use inside an Overview coordinator subagent after `lens-adversarial-review-agent`. Provides the generic coordinator method: inspect scoped evidence, use exploration subagents only when needed, define slices, launch the mode-selected reviewer panel, aggregate findings, and report final panel state."
---

# Lens: Coordinator

## Role

Use this skill inside an Overview coordinator subagent. Mandatory generic skills:

- `/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/lens-adversarial-review-agent/SKILL.md`
- `/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/coord-adversarial-review/SKILL.md`

The coordinator uses `coord-adversarial-review` as the caller-side foundation
for any reviewer, exploration, fallback, or fix-worker subagents it launches.

This is the generic coordinator lens. It owns the shared Overview method:
reviewability triage, scoped evidence inspection, optional exploration support,
slice design, reviewer launch planning, panel creation, and finding
aggregation. Handoff and optimization coordinator lenses are additive.
They must mark this skill as mandatory, reuse this generic exploration, slicing,
panel-creation, and aggregation workflow, add only their role-specific lens
selection, classification, synthesis, follow-up routing, or final-status
behavior, and justify any conflict with this generic coordinator method:

- `/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/lens-coordinator-handoff/SKILL.md`
- `/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/lens-coordinator-optimization/SKILL.md`

## Evidence To Inspect

Prefer direct local evidence:

- `git status --short --branch`
- `git diff --name-status`
- `git diff --stat`
- path-scoped `git diff` for changed instruction, production, build, or
  documentation surfaces
- nearest `AGENTS.md`, owner standards, touched `SKILL.md`, and layer skills
- required verification output or the literal blocker that prevented it
- whether reviewed paths or behavior changed after the provided proof
- whether dirty paths are inside scope, outside scope, or inseparable
- relevant pass logs when the surrounding workflow requires them
- the original success criteria or Done When facts when the review is a
  handoff, completion, or baseline-admission decision

Treat the caller's summary as a locator, not as evidence. Coordinators and
reviewers follow the proof ownership policy in `coord-adversarial-review`: they
inspect provided proof output, report missing or stale proof, and do not rerun
top-level proof tools themselves.

## Concurrent Work And Dirty Baselines

Coordinators must separate the reviewed surface from unrelated dirty work. Do
not widen the review or return `Blocked` merely because the checkout contains
parallel changes outside the assigned scope. Treat unrelated paths as baseline
when owner, path, and proof surfaces are separable.

Dirty work blocks reviewability only when it overlaps the reviewed files, alters
the same behavior covered by the provided proof, changes owner documents needed
for the review, or makes it impossible to tell which diff belongs to the current
pass. In those cases, name the exact overlap or ambiguity instead of citing a
generic dirty-worktree problem.

## Reviewability

Return `Not Reviewable Yet` when a specialist panel cannot inspect reliably.
Common blockers:

- missing required verification and no concrete blocker
- dirty-path ambiguity that prevents separation of this pass from unrelated work
  after path, owner, and proof-surface checks
- unrelated goals mixed into one diff
- missing or contradictory owner documents needed to judge the surface
- stale verification after the reviewed implementation changed
- reviewed files or behavior changed while reviewers were running, making the
  top-level proof no longer applicable
- no concrete artifact, current state, or decision under review
- missing original goal, success criteria, or Done When facts when the assigned
  review must decide whether work is complete

Name the smallest fix needed before a fresh coordinator should run.

## Exploration Support

Use exploration subagents only for broad, separable, read-only questions that
would otherwise flood coordinator context. Exploration subagents are not
reviewers and do not classify findings. They return paths, symbols, evidence
strength, and unknowns so the coordinator can design the panel.

Do not use exploration subagents to outsource the coordinator's final
reviewability or panel decision.

## Review Slicing

Split by the smallest boundary that lets a reviewer inspect deeply:

- canonical owner or layer
- public API or contract surface
- runtime behavior path or user workflow
- build/check/enforcement lifecycle
- security-sensitive boundary
- performance-sensitive path
- UI visual or interaction surface
- developer-facing instruction or onboarding surface

Avoid slicing by arbitrary file count.

## Mode-Specific Lens Selection

This generic coordinator skill does not own a general-purpose review-lens
selection matrix. Select reviewer lenses from the additive coordinator lens for
the assigned mode:

- `lens-coordinator-handoff` selects lenses by same-run handoff risk and
  supported-finding likelihood.
- `lens-coordinator-optimization` selects lenses by improvement signal,
  suboptimality severity, and alternative-synthesis value.

If a future coordinator mode needs different classification or output rules, it
must define its own selection matrix instead of expanding this generic skill.
Repo-specific mandatory skills may be owner evidence, but they are not
specialist review lenses unless a mode-specific coordinator lens assigns them
as such.

## Reviewer Launch

Before launching reviewers, use both coordination layers:

- `/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/coord-adversarial-review/SKILL.md`
- `/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/coord-overview-reviewer/SKILL.md`

Launch nested specialist reviewers only when the current agent has mechanical
subagent-launch capacity. Every reviewer must use
`/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/lens-adversarial-review-agent/SKILL.md` first,
then the assigned specialist lens. Specialist reviewers remain read-only and do
not launch subagents.

If nested launch is unavailable, do not simulate the panel by self-reviewing.
Report the selected panel that could not be launched and return the work to the
caller for a top-level fallback route.

## Aggregation

After reviewers finish:

- deduplicate overlapping findings by underlying issue
- preserve severity from the strongest evidence
- separate stale findings from current findings when the diff changed
- classify unresolved supported findings as blockers with the adversarial
  finding classes
- report skipped lenses and why they were not selected
- state residual risk

## Coordinator Mode Boundary

This skill creates the review panel and aggregates evidence. It does not decide
whether the panel is a handoff gate or an optimization critique. Additive
coordinator lenses define only how to classify and present the aggregated
findings for their mode:

- `lens-coordinator-handoff`: classify handoff readiness by unresolved
  supported findings versus false positives/review-owned concerns.
- `lens-coordinator-optimization`: classify opportunities by suboptimality
  severity and improvement value, while still surfacing supported findings as
  same-run blockers when found.

## Output

Return a coordinator result with:

- `Reviewability`: `Ready`, `Not Reviewable Yet`, or `Blocked`, with evidence
  checked.
- `Changed / Reviewed Surface`: slices, paths, owner evidence, and grouping
  rationale.
- `Risk Signals`: concrete risks that drove lens selection.
- `Panel`: reviewer, skill, scope, owner evidence, reason, and outcome.
- `Skipped Lenses`: intentionally skipped lenses and reasons.
- `Final Status`: clean, blocked, not reviewable, or verification blocked.

Additive coordinator lenses may require more subsections.

## References

- [Adversarial Review Agent Lens](/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/lens-adversarial-review-agent/SKILL.md)
- [Overview To Reviewer Coordination](/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/coord-overview-reviewer/SKILL.md)
- [Handoff Coordinator Lens](/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/lens-coordinator-handoff/SKILL.md)
- [Optimization Coordinator Lens](/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/lens-coordinator-optimization/SKILL.md)
