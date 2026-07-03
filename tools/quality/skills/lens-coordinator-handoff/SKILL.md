---
name: lens-coordinator-handoff
description: Use inside an Overview coordinator subagent for implementation handoff review after a diff and verification result exist. Adds handoff-readiness reviewability, baseline structural debt triage, specialist panel orchestration, scoped fix-worker routing, proof-staleness handling, and a final clean-or-blocked result on top of `lens-coordinator`.
---

# Lens: Handoff Coordinator

## Role

Use this skill only inside the Overview coordinator subagent for an
implementation handoff review. Mandatory generic skill:

- `/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/lens-coordinator/SKILL.md`

This skill is additive. The generic coordinator workflow lives in
`lens-coordinator`, and the generic proof policy lives in
`coord-adversarial-review`. This skill only adds handoff-specific finding
classification, baseline-debt triage, lens selection, fix-worker routing, and
clean-or-WIP status. It must reuse the generic coordinator's exploration,
slice creation, panel creation, reviewer launch, and aggregation workflow. If
any fix changes the reviewed or tested surface, report stale proof to the main
agent for a top-level proof rerun and fresh coordinator pass.

Handoff review is a completion gate. It decides whether the reviewed state can
honestly be treated as finished for the original user goal, not whether proof
is green or previously known findings are closed. A clean handoff requires all
of these to be true: fresh required proof, fresh review for the final diff,
satisfied Success Criteria / Done When, required lens coverage, accepted
baseline admission, required structural-state disposition when triggered, and
no supported objective-relevant residual debt.

Do not edit files directly, approve the change, commit, stage, push, or run
formatters. Specialist reviewer subagents remain read-only. Follow-up worker
subagents may edit only the disjoint write set explicitly assigned in their
briefing.

## Handoff Reviewability

For implementation handoff, require:

- the implementation diff exists
- required top-level verification has a literal result, or its blocker is known
- the original user goal and Success Criteria / Done When facts are explicit
  enough to judge completion
- reviewed paths and behavior have not changed since that top-level proof
- dirty paths can be separated from this pass, including known parallel work outside scope
- owner documents and mandatory skills are identifiable
- current implementation and review pass-log requirements are satisfied or the
  blocker is explicitly reported

Return `Not Reviewable Yet` if stale proof, ambiguous dirty paths, missing
objective/Done When facts, missing owner evidence, missing current pass logs,
or mixed unrelated goals would make a clean handoff result misleading. Do not
return `Not Reviewable Yet` for unrelated parallel work that is path-, owner-,
and proof-separable from the reviewed scope; report it as baseline or residual
risk instead.

## Handoff Evidence Pass

Before selecting reviewers, inspect the handoff target as a blank-canvas
coordinator rather than as Main's advocate:

- read the original goal, accepted wave/step plan and plan review when
  present, Success Criteria / Done When from their owner artifacts,
  implementation logs, review logs, and code-simplifier evidence
- inspect the diff, owner documents, code paths, proof output, baseline debt,
  dirty boundary, and known findings needed to verify completion claims
- classify Main-provided hints as `Initial Concern Hints`, not reviewer
  questions, expected findings, or acceptance criteria
- extract 3-7 falsifiable handoff claims that could make the final state wrong,
  incomplete, under-proved, over-scoped, stale, or misleading

Use those claims to select lenses and define specialist review slices. Treat
accepted plans as evidence to inspect, not as Main-owned acceptance framing. Do
not forward Main-authored questions, green-proof framing, closed-finding
framing, or Done When wording as the reviewer acceptance frame.

## Handoff Lens Selection

Select lenses by coordinator-derived handoff claims and concrete handoff risk,
not by panel size or optimization value. Prefer the narrowest specialist lens
that can answer the current same-run blocking question. Add a second lens to
the same slice only when it answers a distinct handoff-readiness risk.

Use these lenses for handoff review:

- `lens-architecture`: mandatory when the goal or diff involves architecture,
  refactor, governance, state ownership, system-of-record, consistency
  boundaries, dependency direction, public API, layering, adapter/seam
  reduction, baseline admission, repeated fix loops, or other
  architecture-significant constraints. In handoff mode, evaluate whether the
  current state satisfies the architecture objective; do not stop at "fits the
  existing architecture" when the goal is to change or repair that
  architecture. When the reviewed slice touches stateful domain, runtime, view,
  view-model, data, command, mapper, projection, persistence-row, enum,
  value-object, draft, session, or content-model code, require the architecture
  reviewer to return the Structural State Ownership Matrix from
  `lens-architecture`.
- `lens-quality`: use as the broad default for production, build,
  check/enforcement, or non-trivial instruction changes when maintainability,
  readability, smell, and simplicity risks are mixed and no narrower lens
  dominates.
- `lens-security`: use whenever the reviewed scope touches credentials,
  secrets, auth, authorization, external input, parsing, persistence,
  dependencies, process execution, file or network access, scanner findings, or
  sensitive data. Treat this as mandatory when a security surface exists.
- `lens-performance`: use when a regression could ship through hot paths,
  rendering, startup, memory pressure, expensive queries, batch work, large data
  volume, lifecycle cost, or concurrency/resource handling.
- `lens-structure`: use for file, folder, package, module, artifact, or
  co-location changes that can affect owner boundaries, discoverability, or
  future maintenance.
- `lens-conventions`: use when the diff introduces or depends on pattern drift,
  competing local idioms, naming inconsistency, placement inconsistency, or a
  convention-setting choice that could spread after handoff.
- `lens-onboarding`: use for developer-facing docs, comments, READMEs,
  `AGENTS.md`, `SKILL.md`, workflow rules, pass logs, or other instruction
  surfaces where unclear guidance could cause repeated misuse after handoff.
- `lens-design`: use for UI visual craft risks: hierarchy, spacing, color,
  typography, iconography, polish, component aesthetics, or design-system fit.
- `lens-ux`: use for UI behavior risks: flows, mode transitions, state
  preservation, information architecture, workflow efficiency, and system-level
  interaction coherence.
- `lens-simplicity`: use when a narrow handoff risk is caused by avoidable
  concepts, abstractions, files, types, or lines that make the current change
  harder to verify or maintain.
- `lens-smells`: use when a concrete anti-pattern may make the handed-off code
  fragile: duplication, shotgun surgery, temporal coupling, hidden coupling,
  speculative generality, test smells, or other compounding maintainability
  smells.
- `lens-elegance`: use when naming, API shape, control flow, debuggability, or
  teachability could create a current-pass handoff risk even though behavior
  works.
- `lens-critical-analysis`: use sparingly for disputed Must/Should
  classification, go/no-go tradeoffs, finding triage, or whether an issue
  belongs in this handoff pass.
- `lens-research-alternatives`: normally skip in handoff mode. Use only when
  current external evidence is required to decide a handoff-blocking question;
  do not browse for general alternatives during handoff review.

Selection rules:

- Select by risk signal and expected handoff impact. Do not include a lens just
  because it is generally useful.
- Prefer `lens-quality` only for broad maintainability risk. Prefer
  `lens-architecture`, `lens-security`, `lens-performance`, or
  `lens-structure` when that risk clearly dominates.
- Include `lens-security` whenever a security surface exists, `lens-design` or
  `lens-ux` for UI surfaces with visual or interaction risk,
  `lens-performance` for performance-sensitive paths, and
  `lens-architecture` or `lens-onboarding` for governance, check, doc, or
  instruction-facing surfaces as the concrete risk requires.
- Include `lens-architecture` for every architecture, refactor,
  state-ownership, system-of-record, adapter/seam, repeated-fix, or
  Clean-Break handoff. If this required lens cannot launch, final status is
  `WIP - Review Panel Blocked`.
- Treat a triggered but missing, incomplete, or unresolved Structural State
  Ownership Matrix as a handoff blocker. A matrix row classified as
  `Handoff Blocker` blocks clean handoff until fixed and re-reviewed. A row
  classified as `Materialization Required` blocks clean handoff until Main
  materializes the debt through the caller's debt mechanism or obtains an
  explicit user exclusion.
- Include `lens-quality`, `lens-smells`, `lens-simplicity`, or a narrower
  quality lens when the changed state carries broad maintainability,
  accidental-complexity, cohesion, duplication, or god-object risk.
- Keep optimization-only questions out of the handoff panel unless the answer
  can affect same-run handoff readiness.
- When existing architecture, checks, harnesses, or rules look suboptimal,
  classify the issue as blocking if it is a supported finding in the reviewed
  state; otherwise close it as false-positive/review-owned with evidence.
- Repo-specific mandatory skills may be owner evidence, but they are not
  specialist review lenses unless assigned here by concrete handoff risk.

For each selected reviewer, brief exactly one coordinator-derived handoff risk
proposition with evidence to inspect, what would make the handoff wrong, one
alternative, rejected shortcut, or tradeoff to compare, and the expected
specialist judgment. A reviewer briefing is invalid when it only asks whether
proof is green, Done When appears satisfied, logs exist, known findings are
closed, or the diff is formally inside scope.

## Handoff Finding Policy

Handoff review looks for adversarial review findings that affect release,
handoff readiness, or objective completion. Every supported finding blocks
handoff until fixed in the same run and re-reviewed. False-positive or
review-owned concerns are non-blocking only when the coordinator records the
closing evidence.

Sort handoff output by handoff impact: unresolved blocking findings first, then
false-positive/review-owned concerns.

Do not return `Clean` merely because required proof passed, the diff compiles,
or known findings are closed. Do not return `Clean` when the coordinator merely
forwarded Main hints or selected reviewers only confirmed formal handoff facts.
Return `Clean` only when the current state is acceptable as final for the stated
objective.

## Baseline Structural Debt

Handoff review must not silently normalize supported structural debt merely
because it predates the current diff. When reviewers find source-of-truth
duplication, unclear state ownership, competing mutation paths, stringly typed
protocols, shotgun-surgery patterns, god objects, or other architecture/quality
debt in the reviewed scope, classify it separately from same-run handoff
findings:

- `Handoff Blocker`: the current diff introduces, worsens, depends on, or
  leaves unresolved a problem that would make this handoff misleading.
- `Materialization Required`: the problem is pre-existing, outside the user's
  current objective, and not proportional to fix in the current pass, but it is
  supported by evidence in the reviewed scope and must be recorded through the
  caller's debt mechanism, issue tracker, or explicitly named handoff artifact
  before the pass is considered complete.
- `Materialized`: the problem is incidental supported debt and has already
  been recorded through the caller's debt mechanism with evidence available in
  the handoff.
- `Fixed`: the current pass removes or resolves the supported debt.
- `User-Excluded`: the caller explicitly excluded the debt family or affected
  paths from the current pass; record the exclusion.
- `False Positive`: the concern is factually disproven by evidence.

Do not put supported structural debt under `False Positive / Review-Owned`
only because it is baseline, outside the immediate write set, or already
mentioned in a pass log. Baseline status affects whether it blocks same-run
code changes; it does not make the finding disappear.

Debt that belongs to the requested objective is never `Materialization
Required` baseline. It is `WIP - Objective Not Satisfied` or
`WIP - Architecture Completion Blocked` until fixed, explicitly user-excluded,
or returned as a blocker.

For stateful reviewed scopes, preserve the Structural State Ownership Matrix in
the Overview result. Do not collapse matrix rows into a prose summary. The
matrix is the handoff evidence that the architecture lens actually inspected
single source of truth, state ownership, mutation paths, encapsulation,
aggregate boundaries, tell-don't-ask, coupling, duplication, cohesion, typed
boundary protocols, null/placeholder semantics, and draft/view state.

## Follow-Up Workers

For actionable findings, launch follow-up worker subagents only when the fix is
scoped, disjoint from other active workers, and directly tied to the current
handoff. Worker prompts must name the exact write set, preserve the original
user goal, avoid reverting unrelated changes, and report changed paths plus
verification needs.

Do not assign a worker any file another active worker may touch. If nested
worker launch fails or the fix is too coupled to delegate safely, report the
blocker in `Overview Result` and return the work to the main agent instead of
editing files directly.

## Proof Freshness Loop

After any fix changes the diff or reviewed behavior:

1. Mark the provided top-level proof as stale for the affected surface.
2. Stop using prior reviewer results where the changed diff invalidates them.
3. Return the stale-proof state to the main agent instead of rerunning proof
   tools yourself.
4. Resume review only after the main agent provides a fresh top-level proof
   result or a concrete blocker.

Do not return `Clean` using proof from an older diff. Follow the proof ownership
policy in `coord-adversarial-review`; do not run top-level proof tools inside
the coordinator.

## Output Format

Return one top-level section named `Overview Result`. Inside it, include exactly
these subsections when `Reviewability` is `Ready` or `Blocked` after panel
launch:

- `Reviewability`: `Ready` or `Blocked`, evidence checked, and any blockers.
- `Changed Surface`: one bullet per slice with paths, owner evidence, and why
  the paths belong together.
- `Risk Signals`: one bullet per concrete risk signal and affected slice.
- `Coordinator-Derived Handoff Risk Propositions`: the 3-7 claims used to
  select reviewers, with the evidence and countercondition for each.
- `Handoff Findings`: unresolved blocking findings first, then false-positive
  or review-owned concerns with evidence.
- `Structural State Ownership Matrix`: include the matrix from the architecture
  reviewer when triggered, or `Not Triggered` with code-scope evidence when the
  reviewed scope is not stateful.
- `Baseline Structural Debt`: supported pre-existing architecture or quality
  debt observed in the reviewed scope, classified as `None`, `Fixed`,
  `Materialization Required`, `User-Excluded`, or `False Positive`.
- `Objective Completion Verdict`: whether the current state satisfies the
  original goal and Done When criteria; if not, name the blocking final status.
- `Baseline Admission`: fresh proof, fresh review, objective completion,
  required lens coverage, structural-state matrix disposition, debt
  disposition, and whether any supported finding remains only in logs.
- `Panel`: one entry per reviewer with `Reviewer`, `Skill`, `Scope`,
  `Owner Evidence`, `Depth`, `Reason`, and final outcome.
- `Follow-Up Workers`: one entry per worker launched with write set, finding
  addressed, changed paths, verification result, and outcome; write `None` when
  no workers were launched.
- `Skipped Lenses`: specialist skills intentionally not selected, with the
  reason.
- `Final Status`: `Clean`, `WIP - Objective Not Satisfied`,
  `WIP - Architecture Completion Blocked`,
  `WIP - Debt Materialization Required`,
  `WIP - Must Fix Before Handoff`, `WIP - Review Panel Blocked`, or
  `WIP - Verification Blocked`.

If `Reviewability` is `Not Reviewable Yet`, use an abbreviated `Overview
Result`: include `Reviewability`, `Changed Surface`, `Risk Signals`, `Skipped
Lenses`, and `Final Status`; set `Final Status` to `WIP - Not Reviewable`;
omit `Panel` and `Follow-Up Workers`, and provide only the blockers and the
minimum evidence needed before a fresh Overview coordinator should run.

If nested reviewer launch is mechanically unavailable after reviewability and
slicing are complete, do not use the abbreviated `Not Reviewable Yet` output.
Return an `Overview Result` with `Reviewability: Blocked`, include the selected
`Panel` entries that could not be launched, set `Follow-Up Workers` to `None`,
and set `Final Status` to `WIP - Review Panel Blocked`. Each blocked panel
entry must name the reviewer skill, scope, owner evidence, reason for selection,
and the exact caller fallback needed. Do not call this a verification blocker
unless a required proof command or proof artifact is also missing, stale, or
failed.

## References

- [Main To Overview Coordination](/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/coord-main-overview/SKILL.md)
- [Coordinator Lens](/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/lens-coordinator/SKILL.md)
- [Adversarial Review Agent Lens](/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/lens-adversarial-review-agent/SKILL.md)
