Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-06-25
Source of Truth: Governance for agent instruction surfaces, the mandatory
global instruction skill, and ownership boundaries between instruction
artifacts.

# Agent Instruction Standard

## Goal

SaltMarcher treats agent-facing instructions as governed engineering artifacts.
Changes to those artifacts must use the global `agent-instruction-engineering`
skill and must preserve a single canonical owner for each instruction topic.

## Covered Surfaces

This standard applies to Markdown artifacts whose primary purpose is to steer
Codex or other agents:

- `AGENTS.md`
- any `SKILL.md`
- architecture standards or other rule docs that directly define agent behavior
- narrow prompt or workflow markdown that is primarily for agent execution

The surface also includes `agents/openai.yaml`, but only as derived interface
metadata that must stay consistent with the governing skill.

This standard does not apply to ordinary feature specs, UI docs, persistence
docs, or ADRs unless those files are themselves defining agent behavior.

## Mandatory Skill

The global skill is:

- source path:
  `/home/aaron/.codex/skills/local/agent-instruction-engineering/`

Any work on covered surfaces must use that skill first.

- The global copy is the canonical skill source.
- If the harness does not auto-discover global skills, read and apply the
  global `SKILL.md` directly before editing covered artifacts.
- The governing workflow lives in the global `SKILL.md`.
- `agents/openai.yaml` must not become a second source of truth for workflow.

## Standard Coordinated Workflow

Every requested repo-tracked mutation MUST use the Standard Coordinated
Workflow. Read-only planning/review, status reporting, and non-mutating
inspection stay outside because they do not change tracked files. The global
`wave-coordination` skill operates
`Goal Definition -> CR -> CR Review -> Planning Bundle -> Plan Review -> Implementation -> Review -> Commit/Handoff`.

Main is coordinator-only after CR intake. Main owns goal clarification, CR
authorship, role launch packets, artifact paths, allowed write surfaces, dirty
baseline tracking, deterministic guard/provenance checks, blocker coordination,
freshness checks, aggregation from accepted coordinator output, and final
handoff/commit state. Main must not author roadmaps, phase plans, step plans,
implementation diffs, generated review artifacts, role-owned proof, final
integrated proof, direct specialist reviewer prompts, or review acceptance.

Mutation Authority Gate: before `apply_patch`, staging, proof, handoff, or
commit for a repo-tracked implementation mutation, Main MUST have the accepted
CR, accepted CR review, planner-authored planning bundle, accepted plan
review, and passing artifact-chain guard for the target step plan.
User-approved plans, assistant `<proposed_plan>` blocks, chat confirmations,
and "please implement this plan" are goal-definition input only; they do not
authorize `apply_patch`, staging, proof, handoff, commit, or direct
Main-owned implementation. If Main already mutated tracked files without that
authority, stop, mark `WIP - Governance Chain Violated`, make no stable
handoff claim, and repair through a fresh CR-governed workflow; retroactive
acceptance does not stabilize the bad pass. Main may directly write only
Main/User goal-definition and CR artifacts before the gate. Missing reviews,
role provenance, downstream permission, roadmap, authorized step-plan
coverage, or any `minimal chain` shortcut keeps WIP.

Implementation uses clean-start `wave-implementation-worker` agents. Workers
own worker-local proof in implementation logs. Verification Runner owns final
integrated proof. One Implementation Review Coordinator owns review, including
the qualitative `code-simplifier` packet and risk-selected handoff lenses.
Unavailable required role tooling keeps the pass WIP/blocked; Main may record
the blocker but must not substitute the missing role.

Main must know write ownership before launching each workflow role:

| Artifact | Writer role | Main launch obligation |
| --- | --- | --- |
| Goal definition and CR | Main/User | Main may write these intake artifacts and must keep requested plans as input, not authority. |
| CR review | CR Review Coordinator | Launch through `coord-main-cr-review`, assign exactly one CR review path as the allowed write surface, and do not write or replace it from Main. |
| Roadmap, phase plan, and step plan | Planner | Launch one planner with accepted CR/review, assign the roadmap plus required phase and step-plan paths, and limit the planner write surface to those planning-bundle artifacts. |
| Planning-bundle review | Plan Review Coordinator | Launch through `coord-main-plan-review`, assign exactly one plan-review path for the roadmap/phase/step bundle as the allowed write surface, and do not write or replace it from Main. |
| Implementation log | Implementation Worker | Launch from one accepted step plan with one assigned implementation-log path; the worker writes that log after implementation and worker-local proof. |
| Final integrated proof | Verification Runner | Launch with assigned command surface, evidence section or log path, allowed proof write surface, start time, and unavailable-tool fallback. |
| Review log | Main Aggregator from Implementation Review Coordinator result | Assign the review-log path before review; the coordinator returns a result, and Main writes the aggregate from accepted coordinator evidence. |

The Implementation Artifacts Standard owns artifact roles and guard-readable
fields. Caller and author skills repeat only role-local field needs.

### Role Launch Artifact Contract

Every delegated role launch packet must name the input authority, required
output artifact path or evidence section, allowed write surface, and blocked
fallback. Missing output assignment is a workflow blocker, not permission for a
role to invent an artifact or return chat-only status.

| Role | Input authority | Required output |
| --- | --- | --- |
| Planner | accepted CR and CR review | assigned roadmap, phase plans, and step plans only |
| CR Review Coordinator | CR | one assigned `*-cr-review.md` |
| Plan Review Coordinator | planning bundle and accepted CR review | one assigned `*-plan-review.md` |
| Implementation Worker | one accepted step plan | assigned implementation log plus plan write set |
| Verification Runner | final checkout and assigned commands | assigned evidence section or proof log only |
| Implementation Review Coordinator | plan, logs, proof, review-log destination | coordinator result, not review log |
| Main Aggregator | accepted coordinator result and proof | assigned aggregated review log |

## Planning-Time Structural State Preflight
Before planning-bundle creation or briefing implementation/refactor/governance repair
for stateful domain, runtime, view, view-model, data, command, mapper,
projection, persistence-row, enum, value-object, draft, session, or
content-model code, Main MUST classify Structural State Preflight as
`Triggered` or `Not Triggered`.

When triggered, Main runs or delegates a read-only architecture/state review
before the plan is decision-complete. The compact matrix covers ownership,
mutation paths, consistency boundary, coupling, duplication, typed boundary
protocols, placeholder/null semantics, and draft/view truth. Each row is
`Planning Blocker`, `Plan Must Address`, `Incidental Debt`, `Clean`, or
`Not Triggered`; non-clean rows need a slice, blocker/WIP status,
project-health route, or explicit user exclusion. Handoff review must not be
the first structural-state ownership check.

## Blocker Reflection Gate

When proof, handoff review, architecture review, behavior-harness feedback,
quality review, or a repo-local gate blocks a pass, Main MUST stop before
planning a repair and classify one primary blocker: `Local Defect`,
`Target Architecture Violation`, `Stale Or Over-Broad Gate`, `Governance Gap`,
`Missing Proof`, `Unclear Root Cause`, or `Foreign Baseline`.

If the repair may change architecture, layer boundaries, state ownership, typed
boundaries, system-of-record facts, harness/check rules, or project health,
Main must obtain read-only architecture and quality judgment, or a planner
project-health repair plan that includes those lenses, before choosing the
repair. The record must compare the target-architecture repair against the
shortest local unblocker, name any cleaner gate/harness repair, and capture the
blocker source, classification, chosen repair surface, rejected shortcut,
target-architecture or project-health benefit, proof route, and WIP/blocker
status. Main must not start a gate-shaped quick fix while those facts are
missing.

## Review Skill Routing

Review instructions live in skills; mandatory subagent use is authorized.

- CR review uses repo-owned `coord-main-cr-review`, one coordinator,
  `lens-coordinator-cr-review`, `coord-planning-reviewer`, and
  `lens-cr-artifact`. Reviewer launch failure or formal-only content-lens
  review is `Blocked`.
- Planning-bundle review uses `coord-main-plan-review`, one coordinator,
  `lens-coordinator-plan-review`, `coord-planning-reviewer`, and
  `lens-plan-artifact` for the roadmap, phase, and step-plan bundle.
- Verification Runner executes assigned proof commands for the final integrated
  state. If the runner or required proof command is unavailable, the pass stays
  WIP/blocked with no Main fallback.
- Implementation review uses `coord-main-implementation-review`, one
  Implementation Review Coordinator, `lens-coordinator-implementation-review`,
  the required `code-simplifier` packet, and risk-selected specialist lenses.
  Not-reviewable or blocked results keep the pass WIP until fixed, freshly
  proved by Verification Runner, and reviewed again.
- Implementation review is a completion gate: it checks original goal, Done
  When, architecture/quality objectives, proof oracle, and project-health
  baseline admission. Green proof is necessary but insufficient.
- Architecture, refactor, governance, state-ownership, system-of-record,
  adapter/seam, repeated-fix, or Clean-Break work includes the architecture
  lens or reports `WIP - Review Panel Blocked`; add quality/smell/simplicity
  lenses when complexity risk remains.
- When Structural State Review is triggered, implementation review must include
  a fresh architecture-lens matrix. Missing, incomplete, contradicted, unresolved
  `Handoff Blocker`, or unsynchronized `Materialization Required` rows prevent
  `Clean`.
- Objective-relevant residual debt blocks handoff until fixed, user-excluded,
  or reported WIP/blocker. Incidental supported debt may be materialized only
  through project-health.
- Reviewers inspect literal proof and report missing/stale proof. If reviewed
  paths or behavior change, the coordinator returns `Proof Refresh Required`;
  Main launches a fresh Verification Runner and waits for the coordinator's
  final aggregation.
- Global review specialist skills remain supplementary lenses; do not create
  repo-local copies unless the user explicitly asks for a SaltMarcher fork.

## Qualitative Simplification And Repair Gate

Covered implementation passes include the installed `code-simplifier` packet inside Implementation Review Coordinator review. It checks simplicity, elegance, smells, and performance; it does not create gates, weaken proof, or close architecture/state-ownership/system-of-record risk by itself.

Review blockers default to `Planner Repair Required`. The coordinator may route a direct fix only for `Trivial Mechanical Fix`: exactly one obvious correction, no accepted-plan decision change, and no owner, architecture, code-health, proof, harness, PMD, API, state, shape, or target-model concern. All other blockers, including code-health, PMD/quality-rule, `code-simplifier`, smell, ownership, harness/gate, repeated-fix, proof-oracle, and multi-repair findings, require Blocker Reflection plus a global-planner repair plan.

For `Planner Repair Required`, Main gives neutral evidence only; the planner weighs the original goal against review findings, rejects fast fixes that harm target architecture or maintainability, and returns repair form, write set, proof route, risks, and Done When. It does not implement or replace review.

## Problem History Intake

For bug, regression, refactor, governance, systemic-repair, or repeated-fix
work, Main MUST inspect pass logs before planning. Run `rg` in
`build/agent-pass-logs/` for surface, symptom, owner, harness, check, and
repair terms; read newest relevant matches. Cite logs or state none existed.

The intake must identify prior attempts, outcomes, abandoned approaches,
repeated symptoms, and whether the plan repeats a surface fix. Repeated churn
or the same symptom with shallow fixes blocks planning until Main records the
root-cause hypothesis, deeper repair, rejected shortcut, and planner escalation
or WIP/blocker status.

Known structural debt discovered by the intake must be fixed, closed as false
positive, user-excluded, held as WIP/blocker, or materialized through
`PROJECT_HEALTH_DEBT` and the project-health register before handoff.
Materialized debt is not a terminal follow-up. When a later pass touches a
matching repo-relative path or owner area, the project-health debt intake pulls
the entry into the current scope. Main must resolve it, close it with evidence,
obtain explicit user exclusion, or keep the pass WIP/blocked.

## Implementation And Review Pass Logs

SaltMarcher uses local implementation artifacts as generated operational
evidence for loops, reversals, quality drift, and architecture friction. They
are not canonical documentation and must not redefine requirements, contracts,
architecture, domain truth, or verification policy. CRs, roadmaps, wave plans,
implementation logs, review logs, completion audits, filenames, field lists,
artifact indexes, link rules, and decision/blocker-log requirements live in
`docs/project/architecture/implementation-artifacts.md`;
`docs/project/architecture/implementation-documentation.md` is the routing
entry standard.

- Implementation Workers must write one implementation pass log after each
  repo-tracked implementation pass and worker-local proof.
- Verification Runner and implementation-review roles must read relevant
  implementation, qualitative packet, proof, and review pass logs before final
  status.
- Nested specialist reviewers remain read-only and include pass-log evidence
  and trend observations in their reviewer output.
- The required review pass log is an aggregated Implementation Review
  Coordinator cycle log from coordinator output, reviewer outputs, qualitative
  packet evidence, and Verification Runner evidence.
- Pass logs live under `build/agent-pass-logs/` as generated local evidence.
  Link them to the roadmap or plan; do not commit or cite them as canonical
  truth.
- Pass logs are also local memory for expected wait times. Record observed
  durations for recurring long checks when they materially affect future
  pacing or blocker interpretation.
- Missing pass logs for prior work do not block a pass by themselves, but a
  required current implementation or review pass without its log remains WIP
  until the log is written or the blocker is reported.
- If the build directory was cleaned, missing logs are unavailable history, not
  evidence that no prior loop or degradation occurred.

## Wait-Time And Polling Evidence

Before launching or waiting on a worker, reviewer, Verification Runner,
long-running proof/check, or install process, record the exact local start time
and expected first-poll time. Inspect the newest comparable pass or Gradle run
log once and use its last duration for the first poll. If no comparable
duration exists, use observable output or 30-60 second status intervals.

Do not repeatedly rescan history while a process is running, do not launch a
duplicate long job because it is quiet, and do not treat long runtime as
failure. Agent roles get at least 30 minutes of quiet runtime unless they
finish, report a blocker, are explicitly cancelled, or state they will make no
further changes. When a phase launches several required roles, wait for every
terminal result before aggregation. Pass logs record wait-time observations for
recurring process classes: command or role, start time, elapsed time, result,
evidence log path when one exists, and recommended first-poll interval.

## Stable-State Barrier For Waiting Agents

When Main is waiting for an implementation worker, Verification Runner,
Implementation Review Coordinator, reviewer, or scoped fix role that may still
change or judge the target write set, Main MUST treat that target as unstable
until the role finishes, is explicitly cancelled, or reports that it will make
no further file changes.

While the target is unstable, Main MUST NOT launch a Verification Runner,
quality analysis, implementation review, production-handoff, desktop-install,
or other sidecar work against the same checkout or behavior surface. Main may
only do clearly independent work, such as reading governance, updating an
explicitly requested non-overlapping instruction document, checking a launched
process, or waiting.

Before launching a Verification Runner, review, or expensive tools after a
wait, Main MUST refresh current user instruction, active role status, dirty
paths, and open-role ownership. If an active role can still change that
surface, defer until integrated or cancelled. After interruption, user
correction, resume, or compaction, repeat this refresh. Summaries and
remembered skills are
orientation only; before new repo-tracked edits, rerun `context-hygiene`, read
the nearest owner, or state that no edit is being made.

If Main runs independent work while waiting, it must name the independence
boundary and not use the result as evidence for the unstable target surface.

Implementation artifact filenames, headings, metadata, fields, qualitative
packet evidence, wait observations, and Reading Packet fields are owned by the
Implementation Artifact Standard. Instruction surfaces may include owner-linked
extracts, not competing field-list sources.

When a review agent sees a systemic trend instead of an isolated defect, it
must report that trend explicitly. If the trend suggests an architecture-model,
governance, skill, or mechanical-check change, the review reports it as a
blocking finding. Main integrates the repair into the same run.

## Verification Path
- Covered Markdown-only instruction changes that stay inside the documentation
  gate scope use `./gradlew checkDocumentationEnforcement --console=plain`.
- Instruction-only changes that also include `agents/openai.yaml` use the
  Markdown gate plus explicit derived-metadata consistency review against the
  governing `SKILL.md`.
- Covered changes that also touch non-Markdown code, Gradle, build logic, or
  non-covered surfaces still follow the broader verification path owned by
  `AGENTS.md` and the quality-platform standards.
- `agents/openai.yaml` is governed by this standard but is not itself part of
  the Markdown-focused documentation gate scope.

## Ownership Rules
- `AGENTS.md` owns project-wide norms only.
- `AGENTS.md` stays an early router for triggers, owners, and verification; it
  must not become a glossary, feature spec, migration plan, or layer-standard
  copy.
- `SKILL.md` owns reusable agent workflow and trigger logic for one skill.
- `docs/project/<type>/*.md` own reusable project-wide rules for one topic.
- Other instruction markdown may exist only when the topic is narrower than a
  reusable standard or skill.

Move repeated rules to the lowest stable canonical owner; replace other
surfaces with short summaries or links.

## Review Rules
When a covered artifact changes, reviewers check global skill use, topic
ownership, derived metadata, verification fit, accepted artifact chain,
required pass logs, Verification Runner proof, Implementation Review
Coordinator coverage, and read-only specialist review.
