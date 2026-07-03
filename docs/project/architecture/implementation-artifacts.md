Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-02
Source of Truth: Generated implementation artifact placement, naming, status,
linking, CR/review semantics, and pass-log content rules.

# Implementation Artifacts Standard

## Purpose

SaltMarcher uses generated implementation artifacts to make agent work
auditable without turning working evidence into canonical product truth. This
standard owns CR, roadmap, phase-plan, wave/step-plan, implementation-log,
review-log, completion-audit, review-artifact, and Implementation Reading
Packet contracts.

Generated artifacts live under `build/agent-pass-logs/`. They are operational
evidence and local working memory. Do not commit them, do not cite them as
canonical feature/domain/architecture truth, and do not replace owner docs with
them.

## Artifact Groups

Every coordinated goal chooses one stable `<slug>` when the CR is created.
Every generated artifact for that goal uses the same slug plus phase, wave, or
slice qualifiers. Rename the slug only through CR supersession.

Use these filenames:

- CR: `YYYY-MM-DD-<slug>-cr.md`
- CR review: `YYYY-MM-DD-<slug>-cr-review.md`
- Roadmap: `YYYY-MM-DD-<slug>-roadmap.md`
- Planning-bundle review: `YYYY-MM-DD-<slug>-plan-review.md`
- Phase plan: `YYYY-MM-DD-<slug>-phase-NN-plan.md`
- Wave/step plan: `YYYY-MM-DD-<slug>-wave-NN-<slice>-plan.md`
- Implementation log:
  `YYYY-MM-DD-<slug>-wave-NN-<slice>-implementation.md`
- Review log: `YYYY-MM-DD-<slug>-wave-NN-<slice>-review.md`
- Completion audit, broad goals only: `YYYY-MM-DD-<slug>-completion-audit.md`

The roadmap is the active index while work is running. It links every plan,
review, implementation log, proof evidence, status, and next action. Status
rows use exactly: `Wave`, `Plan`, `Implementation`, `Review`, `Proof`,
`Status`, `Next Action`.

## Artifact Roles And Write Ownership

Each generated artifact has a workflow role that writes it. Caller roles must
assign that role's artifact paths and allowed write surface before launch.
Author roles must write only their assigned artifact class. If a required
artifact path, evidence section, or allowed write surface is missing, the
workflow remains WIP/blocked until the caller supplies it; the author role must
not invent a path, widen its write surface, or replace the artifact with
chat-only status.

| Artifact role | Writer role | Guard role value | Main write authority |
| --- | --- | --- | --- |
| Goal definition, CR | Main/User | `Main/User` | Main may write. |
| CR review | Planning Review Coordinator | `Planning Review Coordinator` | Main assigns one CR review path as the allowed write surface but must not write or replace it. |
| Roadmap, phase plan, wave/step plan | Planner | `Planner` | Main assigns the planning bundle paths as the allowed generated-artifact write surface; Main must not substitute chat plans. |
| Planning-bundle review | Planning Review Coordinator | `Planning Review Coordinator` | Main assigns one plan-review path as the allowed write surface but must not write or replace it. |
| Implementation log | Implementation Worker | not guard-checked | Main assigns one implementation-log path; worker writes it after implementation and worker-local proof. |
| Final integrated proof evidence | Verification Runner | not guard-checked | Runner records assigned command results in the assigned evidence section or proof log. |
| Review log | Main Aggregator from Implementation Review Coordinator result | not guard-checked | Main assigns the review-log path before review and writes the aggregate from accepted coordinator evidence. |

Guard-readable primary planning artifacts start with:

- `Artifact Role`: `CR`, `Roadmap`, `Phase Plan`, or `Step Plan`
- `Owner Role`: the writer role from the table above
- `Authored By Role`: the writer role that actually authored the artifact
- `Status`: `Accepted` before downstream use

Guard-readable CR-review artifacts start with:

- `Artifact Role`: `CR Review`
- `Owner Role`: `Planning Review Coordinator`
- `Authored By Role`: `Planning Review Coordinator`
- `Reviewed Artifact Role`: `CR`
- `Artifact Lens`: `lens-cr-artifact`
- `Artifact Lens Status`: `Completed`
- `Content Review Status`: `Completed` or `Not Required`
- `Content Review Rationale`: free prose
- `Verdict`: `Accepted`, `Rework Required`, or `Blocked`
- `Downstream Permission`: `Roadmap creation may proceed` when accepted
- `Reviewed Path`, `Authored Review Path`, and `Allowed Write Surface`, all
  absolute paths

Guard-readable planning-bundle review artifacts start with:

- `Artifact Role`: `Plan Review`
- `Owner Role`: `Planning Review Coordinator`
- `Authored By Role`: `Planning Review Coordinator`
- `Reviewed Artifact Role`: `Planning Bundle`
- `Artifact Lens`: `lens-plan-artifact`
- `Artifact Lens Status`: `Completed`
- `Content Review Status`: `Completed` or `Not Required`
- `Content Review Rationale`: free prose
- `Verdict`: `Accepted`, `Rework Required`, or `Blocked`
- `Downstream Permission`: `Implementation may proceed` when accepted
- `Reviewed Path`, `Authored Review Path`, and `Allowed Write Surface`, all
  absolute paths
- `Reviewed Roadmap Path`: absolute path
- `Reviewed Phase Plan Paths`: comma-separated absolute paths or `None`
- `Authorized Step Plan Paths`: comma-separated absolute paths

These fields are the machine contract. Narrative reviewer evidence, selected
content lenses, skipped-lens explanation, findings, and rationale remain
human-readable review content and must not be made parser-exact.

## CR Semantics

A CR is not the plan. It states the current wrong state, desired target state,
rationale, scope boundaries, non-goals, owner surfaces, acceptance criteria,
and Done When facts. It does not define the route from current state to target
state; the roadmap and plans own that route. User-provided plans, requested
plans, chat confirmations, and `please implement this plan` phrasing are CR
input only, not review artifacts, accepted planning artifacts, downstream
permission, or implementation authority.

CR status values are `Draft`, `Review Required`, `Review Fix Applied -
Re-review Required`, `Rework Required`, `Accepted`, `Blocked`, and
`Superseded`. Main may apply fixes and record `Review Fix Applied`, but only a
planning-review-coordinator-authored review artifact may accept or reject the
CR.

Accepted CRs freeze planning intent. Material changes to goal, owner surfaces,
artifact sequence, acceptance criteria, or Done When require a new CR or a
`Superseded` link.

## Planning Artifacts

One planner authors the planning bundle after CR review acceptance.

Roadmaps preserve the accepted CR, must-do completion goals, owner surfaces,
phase table, artifact index, decision/blocker log, pre-implementation
classifications, proof/review route, and final audit state. The roadmap covers
the work from start state to endpoint. A roadmap must also make the planning
thesis concrete: current structural problem, target model, chosen strategy,
rejected alternatives, initiative/dependency rationale, and the proof thesis
that will show the target is actually achieved. Abstract principle lists,
`where it fits` wording, or generic inventory work do not satisfy roadmap
quality unless each affected surface has a concrete `Adopt`, `Adapt`, `Reject`,
or `Investigate` disposition with evidence and downstream consequence.

Phase plans exist when broad or dependency-heavy work needs dependency-ordered
chunks before implementation. A narrow roadmap records why no phase plan is
needed. Phase planning is part of the same planner-owned bundle, not a separate
planner or separate review gate. Phase plans must make decisions or create a
bounded exploration slice with explicit outputs. They must not defer broad
ambiguity back to Main or create another planning pass without naming the
technical conclusion that pass must produce.

Wave/step plans are the worker's direct authority. They contain slice goal,
read set, semantic write set, conditional write set with trigger, forbidden
write set, generated/log write set, current baseline, role-triggered
owners/skills, Problem History, Project Health, debt intake, Blocker
Reflection, Structural State Preflight, source evidence, implementation
constraints, verification route, review route, and Done When. They must be
worker-ready: the worker must not have to choose API shape, ownership boundary,
migration strategy, slice order, compatibility budget, or proof oracle. If any
of those decisions are still unknown, the plan must authorize bounded
exploration instead of implementation.

Every implementation-ready plan must include the qualitative planning content
needed for review: target-state decision, rejected alternatives and shortcuts,
interface/API decisions, migration path, slice independence or dependency
rationale, behavior-tied acceptance tests, and remaining blockers. Governance
obligations such as artifact-chain guard, Verification Runner,
Implementation Review Coordinator, qualitative review packets, and commit
routing must stay compact enough that they do not hide missing technical
decisions.

Planning is incomplete until every non-clean structural row has a slice,
blocker/WIP status, project-health route, or explicit user exclusion.

## Implementation Reading Packets

An Implementation Reading Packet is the pre-work context given to a delegated
agent before it plans or edits repo-tracked implementation, refactor,
governance repair, systemic repair, or documentation/instruction mutation. It
may be embedded in a prompt, wave/step plan, or handoff note; a
post-work pass log cannot replace it.

The packet records goal, accepted plan or review authority when present,
read/write/forbidden sets, current baseline, dirty-boundary notes, owner docs,
mandatory skills, Problem History, Project Health, debt intake, source
evidence, implementation constraints, verification route, review route, and
Done When. Keep it scoped to the assigned role and link owners instead of
copying their full standards.

## Review Artifacts

CR reviews and planning-bundle reviews are separate coordinator-authored
review artifacts. CR review uses `lens-cr-artifact`. Planning-bundle review
uses `lens-plan-artifact` to check roadmap goal coverage, substantive target
quality, phase decomposition, worker-ready step slices, proof route, review
route, and implementation authority in one panel. The coordinator briefs
reviewers through
`coord-planning-reviewer`; content lenses challenge target direction, baseline
truth, owner fit, architecture/quality decisions, dependency order, proof
feasibility, alternatives, blockers, and residual risk through their assigned
expertise.

Planning review must reject formally complete bundles that are technically
non-decisive, over-governed, vague, or unable to guide a clean-start worker.
Correct provenance fields and guard-readable headers are not enough for
acceptance.

Main must not synthesize a review artifact from a message and must not mark an
artifact accepted after applying fixes. Main must not create or replace
`*-cr-review.md` or `*-plan-review.md`; Main-owned review notes must use
implementation logs, fix logs, or `Review Fix Applied - Re-review Required`
statuses instead.

Planning review verdicts are `Accepted`, `Rework Required`, or `Blocked`.
`Review Fix Applied - Re-review Required` is a Main-owned status, not an
acceptance verdict.

Accepted CRs and implementation-ready wave/step plans are not implementation
authority until `tools/quality/reporting/verify_artifact_chain.py` passes for
the CR and target step plan. The guard requires:

- accepted CR and CR review with `lens-cr-artifact`
- accepted roadmap authored by `Planner`
- accepted phase plans supplied to the guard, also authored by `Planner`
- accepted target step plan authored by `Planner`
- accepted `Plan Review` with `lens-plan-artifact`
- the target step plan listed in `Authorized Step Plan Paths`
- no Main-authored review and no `minimal chain` shortcut

Historical generated logs may keep their original shape. New guarded chains
must use the planning-bundle review contract.

## Implementation Logs

Implementation logs record what actually changed. They must link to the CR,
roadmap, accepted plan, and relevant review artifacts.

An implementation log records actor role, task goal, scope boundary, touched
paths, mandatory skills, Problem History, Project Health, Structural State
Preflight when triggered, implementation summary, dirty-baseline
classification, deviations from plan, worker-local proof commands and literal
results, review needs, wait-time observations, reversals, abandoned
approaches, and open blockers.

## Review Logs

Main writes one aggregated review log after each completed Implementation
Review Coordinator cycle from the coordinator result, reviewer outputs,
qualitative packet evidence, and Verification Runner evidence. Nested
specialist reviewers remain read-only and report pass-log evidence and trends
in their own output.

A review log records reviewed scope, pass logs, final integrated verification
evidence, Objective Completion Verdict, behavior-harness coverage, selected
review panel, qualitative packet outcome, Blocker Reflection review, Structural
State Ownership Matrix when needed, findings, fixes, residual debt
classification, project-health sync, Baseline Admission, trend observations,
wait-time observations, escalation recommendations, and final clean, blocked,
or WIP status.

## Completion Audits

Broad goals use a read-only completion audit before final completion. It
records requirement-by-requirement objective status, roadmap and linked
artifact coverage, unresolved decisions/blockers, clean/WIP state, expected
commit or publication state, proof freshness, target evidence, stale-reference
search, review-log status, dirty-baseline separation, and remaining separate
slices.

## Stale Evidence

Generated logs, harness output, screenshots, and command output are stale when
reviewed paths, behavior surface, proof route, or dirty baseline changes after
capture. Stale evidence may explain history but must not support handoff
readiness.

## References

- [Implementation Documentation Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/implementation-documentation.md:1)
- [Agent Instruction Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/agent-instructions.md:1)
- [Documentation Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/documentation.md:1)
- [Project Health Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/project-health.md:1)
