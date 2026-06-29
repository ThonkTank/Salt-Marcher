Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-06-25
Source of Truth: Canonical implementation-documentation artifacts,
Implementation Reading Packet fields, and generated implementation/review log
content rules for SaltMarcher agent work.

# Implementation Documentation Standard

## Purpose

SaltMarcher uses implementation documentation to make agent work auditable
without turning generated handoff evidence into canonical product truth. This
standard owns the shape of implementation-facing packets, roadmaps, wave
plans, implementation pass logs, code-simplifier evidence, aggregated review
logs, and completion audits.

Implementation documentation is operational evidence. It does not define
requirements, contracts, domain truth, delivery plans, feature behavior,
verification policy, or architecture beyond the workflow rules in this file.
Those topics stay in their owning canonical documents.

## Scope

This standard applies to:

- wave roadmaps and wave plans used to hand implementation work to an agent
- Implementation Reading Packets in prompts, handoffs, wave plans, or local
  working notes, plus pass-log references to the packet actually used
- implementation pass logs under `build/agent-pass-logs/`
- code-simplifier review-agent reports or pass-log summaries
- aggregated Overview review pass logs under `build/agent-pass-logs/`

It does not require a new Gradle task, central gate, tracked ledger, PR
template, or compatibility duplicate of an existing protocol. Other instruction
surfaces should route here instead of copying the packet or log field lists.

## Implementation Reading Packet

An implementation handoff packet is required when a caller delegates a
repo-tracked implementation, refactor, governance repair, systemic repair, or
non-trivial documentation/instruction change to another agent. The packet may
be embedded in the user prompt, a wave plan, or another handoff note, but it
must exist before the delegated worker plans or edits.
Implementation and review pass logs may record or reference the packet that was
used; a post-work pass log cannot replace the required pre-work reading packet.

The packet must include:

- `Goal`: concrete requested outcome.
- `Read Set`: owner docs, skills, source files, logs, and command evidence the
  worker must inspect before editing.
- `Write Set`: exact allowed paths, plus any conditional paths and the
  condition that permits them.
- `Forbidden Write Set`: paths, surfaces, or action classes the worker must not
  touch.
- `Current Baseline`: branch, dirty paths, same-file foreign hunks, and known
  generated or unrelated work that must remain untouched.
- `Owners And Skills`: mandatory owner documents and skills for every touched
  surface.
- `Problem History`: pass-log searches required or already performed, relevant
  logs, repeated symptoms, rejected shortcuts, and planner or blocker
  disposition when churn exists.
- `Project Health`: owner areas, active debt markers, repeated families,
  compatibility/delete signals, scan route, and supported-finding disposition.
- `Project Health Debt Intake`: planned paths or owner areas scanned, active
  matching debt IDs, and each disposition: resolved, false positive,
  user-excluded, or WIP/blocker.
- `Blocker Reflection`: required when current work repairs proof, review,
  architecture, quality, harness, gate, or prior handoff feedback. Include the
  literal blocker source, Agent Instruction Standard classification, candidate
  repair surfaces, target-architecture repair, shortest local unblocker,
  rejected shortcut, chosen repair, proof route, and any WIP/blocker status.
- `Structural State Preflight`: triggered or not triggered, with the affected
  paths and trigger reason when the slice touches stateful domain, runtime,
  view, view-model, data, command, mapper, projection, persistence-row, enum,
  value-object, draft, session, or content-model code. When triggered, include
  the Structural State Ownership Matrix or the roadmap section containing it,
  and the disposition for each non-clean row: fixed in plan, assigned to a
  concrete slice, explicit blocker/WIP, project-health incidental debt route,
  or explicit user exclusion.
- `Source Evidence`: local repo evidence and preserved external reference
  paths used for decisions; state `none` when the pass is not source-backed
  beyond local owner docs.
- `Implementation Constraints`: scope boundaries, non-goals, no-new-gate rules,
  line caps, compatibility limits, and publication limits.
- `Verification Route`: required command, optional narrow local checks, and
  whether final proof is worker-owned or caller-owned.
- `Review Route`: code-simplifier, Overview, specialist review, or caller-owned
  review obligations; unavailable or caller-owned required review keeps the
  slice WIP until completed or reported as a blocker.
- `Done When`: literal file, proof, log, review, and handoff facts required for
  the slice to be considered complete. For user-reported defects, include the
  old failure as a negative condition that the selected proof must make
  impossible.

Do not add packet fields to `AGENTS.md`, repo skills, or adjacent standards.
Those surfaces may require, reference, or summarize the packet, but this file
owns the field list.

## Artifact Contract

The Standard Coordinated Workflow uses Wave Coordination and separate, linked
operational artifacts under
`build/agent-pass-logs/`; roadmaps, plans, implementation logs, review logs,
and completion audits must not collapse into one growing mixed file.

Use these filenames:

- Roadmap: `YYYY-MM-DD-<slug>-roadmap.md`
- Wave plan: `YYYY-MM-DD-<slug>-wave-NN-<slice>-plan.md`
- Implementation log:
  `YYYY-MM-DD-<slug>-wave-NN-<slice>-implementation.md`
- Review log: `YYYY-MM-DD-<slug>-wave-NN-<slice>-review.md`
- Completion audit, for broad goals only:
  `YYYY-MM-DD-<slug>-completion-audit.md`

Roadmaps are temporary coordination indexes written by the first planner after
Main/User goal clarification. They contain the preserved goal, explicit
non-goals, must-do completion goals, affected owner surfaces, what must change
where, phase table, links to plan/log/review artifacts, open blockers, current
next action, and final audit state. Main must review the roadmap before phase
planning or implementation begins. They do not contain full implementation
logs, review findings, architecture truth, feature behavior, contracts, domain
truth, or verification policy. Status rows use exactly:
`Wave`, `Plan`, `Implementation`, `Review`, `Proof`, `Status`, `Next Action`.

For broad, unclear, or dependency-heavy goals, a second planner may split the
roadmap into dependency-ordered phases. Each phase records what must be true,
where, before that phase can be considered complete. Implementation-ready wave
plans may be created later for one phase or slice; they must not replace the
roadmap's must-do completion goals.

Wave plans are the implementation worker's direct authority. They contain the
slice goal, read set, write set, forbidden set, direct constraints, steps,
Done When checks, and proof/review route. If final proof or review is
caller-owned, the plan says so and the worker records skipped caller-owned
obligations as WIP rather than claiming handoff readiness.

Roadmaps and wave plans must classify dirty baseline, likely proof blockers,
Blocker Reflection entries, and triggered Structural State Preflight evidence
before assigning implementation. Planning is incomplete until every non-clean
structural row has a slice, blocker/WIP status, project-health route, or
explicit user exclusion. A `Planning Blocker` may reach a worker only when the
wave plan says the slice resolves that blocker or remains WIP.

Implementation logs record actual touched paths, proof, code-simplifier
disposition, project-health scans, deviations from plan, and worker outcome.
Review logs record Overview result, findings and fixes, final proof freshness,
baseline admission, and clean/WIP status.

Completion audits are read-only final alignment artifacts for broad goals. They
record requirement-by-requirement objective status, roadmap and linked
plan/log/review coverage, clean/WIP status, expected commit or publication
state, proof freshness, target evidence, stale-reference search, review-log
status, dirty-baseline separation, and remaining separate slices.

Existing mixed roadmap files remain historical evidence. New work uses the
separate artifacts above. An active mixed roadmap is normalized only when the
user asks or the roadmap is touched again.

## Implementation Pass Logs

Implementation pass logs live under `build/agent-pass-logs/`. Coordinated
waves use the wave-specific implementation-log filename from the Artifact
Contract. A direct implementation pass outside a wave uses:

- `build/agent-pass-logs/YYYY-MM-DD-<kebab-task-slug>-implementation.md`
- heading `# Implementation Pass Log: <task summary>`
- first metadata line `Timestamp: YYYY-MM-DD HH:MM:SS TZ +HHMM`

Use the local calendar date from the timestamp. If a same-day filename already
exists for a later pass, append `-2`, `-3`, or the next integer before the
suffix. Include `Parent Pass Log:` or `Related Pass Logs:` when the pass
continues, reviews, or fixes known prior work.

An implementation pass log must record:

- actor role, task goal, scope boundary, and related pass logs
- Problem History Intake: search terms, inspected logs, prior attempts,
  outcomes, repeated symptoms, or `no related churn found`; when churn exists,
  include root-cause hypothesis, deeper repair, rejected shortcuts, and planner
  escalation or blocker disposition
- touched paths and intentionally untouched dirty paths
- owner documents and mandatory skills used
- implementation summary and key tradeoffs
- code-simplifier outcome for covered passes, including lenses or role used,
  patches, skipped status, evidence path or report, and each finding
  disposition
- Blocker Reflection Gate outcome when the pass repairs proof, review,
  architecture, quality, harness, gate, or prior handoff feedback: literal
  blocker source, classification, alternatives compared, architecture/quality
  judgment or planner result, chosen repair surface, rejected shortcut,
  target-architecture or project-health benefit, proof route, and remaining
  WIP/blocker status
- planner escalation outcome when systemic review, architecture-check,
  behavior-harness, or proof feedback shaped the project-health plan
- delete signals consumed, markers added for new or retained transitional
  support, retire actions, and unmarked known-support blockers
- Project Health: scan command/result, debt IDs touched, repeated families, and
  supported findings fixed, closed, blocked, or materialized
- Project Health Debt Intake: command/result, matching active debt IDs, and
  resolver disposition for every match
- Structural State Preflight: `Triggered` with changed paths and trigger
  reasons, or `Not Triggered` with the code-scope reason. When triggered,
  record the planning matrix or roadmap reference used before editing, each
  non-clean row disposition owned by the pass, and that final Overview must
  include a fresh Structural State Ownership Matrix before handoff can be
  clean.
- Behavior Harness Coverage: owning harness changes, dependency suites,
  literal harness result, `Harness Gap`, or no-behavior-change evidence. For
  user-reported defects, record the negative assertion that proves the old
  failure is impossible, or keep the pass WIP with a Harness Gap.
- verification commands and literal results
- Wait-Time Observations for recurring long-running processes: command or
  class, elapsed time, result, evidence path, and next first-poll interval
- reversals, abandoned approaches, repeated edits, architecture friction,
  quality friction, maintainability friction, elegance friction, performance
  friction, open blockers, and review needs

## Wait-Time And Polling Evidence

Before waiting on a recurring long-running process, inspect the newest relevant
local pass log or retained Gradle run log when available. Use the newest
comparable duration as the expected first-poll interval.

If a comparable run took several minutes, wait near that duration before the
first completion poll unless the process emits meaningful output that needs
triage. If no prior duration exists, use observable wrapper output or normal
30-60 second status intervals until the process class has one recorded duration.

While a process is running, do not repeatedly rescan wait-time history unless
the first estimate is clearly stale or the process emits a new failure signal.
After the expected wait has elapsed, poll at a moderate interval until
completion or failure. Do not launch duplicate Gradle, harness, verification,
installation, or review processes only because a known long-running process is
quiet.

## Code-Simplifier Evidence

The code-simplifier step is qualitative review-agent evidence, not a gate. A
covered implementation pass must record whether it ran, which role or lenses
were used, what changed, and how Main disposed every finding. Valid
dispositions are fixed with required proof rerun, assigned to a same-run worker
and integrated, planner-integrated, explicitly user-excluded, blocked/WIP, or
closed as false positive or review-owned with evidence.

Unclassified `deferred`, `follow-up`, `later`, `outside write set`, or unowned
`review-owned` findings block Overview readiness.

## Review Pass Logs

Aggregated review pass logs live under `build/agent-pass-logs/`. Coordinated
waves use the wave-specific review-log filename from the Artifact Contract. A
direct review pass outside a wave uses:

- `build/agent-pass-logs/YYYY-MM-DD-<kebab-task-slug>-review.md`
- heading `# Review Pass Log: <task summary>`
- first metadata line `Timestamp: YYYY-MM-DD HH:MM:SS TZ +HHMM`

The main handoff agent writes one aggregated review pass log after each
completed Overview review cycle from the Overview result and reviewer outputs.
Nested specialist reviewers remain read-only and report pass-log evidence and
trend observations in their reviewer output.

A review pass log must record:

- review role, reviewed scope, reviewed pass logs, and verification evidence
- Objective Completion Verdict: whether the reviewed state satisfies the
  original goal and Done When criteria, or the exact WIP status when it does
  not
- behavior-harness coverage, including missing `Harness Gap` blockers
- proof-oracle review for user-reported defects: the production route exercised
  and the negative assertion that would fail if the old bug remained
- wait-time evidence when review depends on long-running proof or harnesses
- selected review panel or unavailable nested-review blocker
- selected and skipped lenses, including required architecture/quality lenses
  for architecture, refactor, state-ownership, system-of-record, seam, or
  repeated-fix work
- Blocker Reflection review: for blocker-driven repairs, verify that the
  implementation log or roadmap recorded the blocker classification,
  alternatives, rejected shortcut, selected repair surface, and proof route
  before the fix began. If the repair only satisfies a gate while weakening
  target architecture or project health, the review remains WIP/blocker.
- Structural State Ownership Matrix: include the matrix when Structural State
  Review was triggered, or `Not Triggered` with code-scope evidence. Compare
  the final matrix against the planning preflight rows and report any new,
  missing, or contradicted row. Matrix rows must use the architecture-lens
  dispositions and code references; an unresolved `Handoff Blocker`, an
  unresolved planning `Planning Blocker`, or `Materialization Required` row
  keeps the review WIP. Incidental debt synchronized through project-health
  must be recorded as `Materialized` with evidence.
- findings and fix outcomes
- Problem History Intake accepted or blocked
- Project Health marker/register sync and supported-finding disposition
- Project Health Debt Intake accepted or blocked
- residual debt classification: fixed, false positive, explicitly
  user-excluded, materialization required for incidental debt, or WIP/blocker
  for objective-relevant debt
- Baseline Admission: fresh proof, fresh review, objective completion,
  synchronized debt markers/register entries, and no supported finding hidden
  only in pass logs
- trend observations, including repeated reversals, looped implementation,
  growing complexity, recurring smells, architecture loopholes, normalized
  delete signals, or repeated governance/check misses
- escalation recommendations for systemic governance, skill, check, or
  architecture changes
- final clean, blocked, or WIP status

## Stale Evidence And Harness Support

Generated logs, harness output, screenshots, and command output are stale when
the reviewed paths, behavior surface, proof route, or dirty baseline changes
after the evidence was captured. Stale evidence may explain history, but it
must not support a handoff-readiness claim.

Harnesses support behavior claims only when they exercise the owning production
route or owner API named by the relevant feature/verification standard and
assert the behavior that matters to the claim. For user-reported defects, at
least one proof must be negative: it must fail if the old route, visual state,
mutation path, fallback, or stale projection still exists. A harness that only
proves a new happy path while the old failure can still occur is a
self-confirming harness and cannot support handoff readiness. Manual testing
may supplement harness proof. It must not replace available production-path
harness proof, and missing credible harness ownership or missing negative
coverage is a `Harness Gap`.

## Proof And Review Ownership

Proof routes are owned by `AGENTS.md` and the quality-platform verification
standards. This standard only says how to record proof evidence in
implementation documentation. Required proof tools run at the top-level
handoff layer unless a wave-plan artifact explicitly assigns a narrower
worker-owned check.

Review routing is owned by `docs/project/architecture/agent-instructions.md`
and the global review skills. This standard records the log artifacts and field
requirements for those reviews. It must not create SaltMarcher-local copies of
global review skills.

## References

- [Agent Instruction Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/agent-instructions.md:1)
- [Agent Context Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/agent-context.md:1)
- [Documentation Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/documentation.md:1)
- [Project Health Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/project-health.md:1)
- [Quality Platforms](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/verification/quality-platforms.md:1)
- [Quality Platforms Local Entrypoints](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/verification/quality-platforms-local-entrypoints.md:1)
- [Source References Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/verification/source-references.md:1)
