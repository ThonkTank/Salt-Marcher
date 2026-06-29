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

Non-trivial repo-tracked implementation, refactor, migration, governance
repair, systemic repair, repeated-fix, or broad documentation/instruction work
MUST use the Standard Coordinated Workflow unless the user explicitly asks for
read-only planning/review or the task is a trivial mechanical edit with no
semantic workflow, governance, architecture, behavior, proof, or ownership
effect. The global `wave-coordination` skill operates
`Goal Definition -> Roadmap Planning -> Phase Planning -> Implementation -> Review -> Commit/Handoff`.

Main owns intake, skill routing, dirty baseline, proof, integration, and
publication state. Main clarifies goals with the user before delegation. The
first clean-start planner uses `planner` to write the Main-reviewed roadmap
with must-do completion goals and required change surfaces. A
second clean-start planner is required only when scope is broad, dependency
order is unclear, or phase boundaries need separate decomposition. Later
planning prepares implementation-ready wave-plan artifacts as needed for each phase or
slice. Implementation uses clean-start `wave-implementation-worker` agents with
disjoint write sets; Review uses `code-simplifier` and Overview. Required
subagent launches are standing user authorization; unavailable subagent tooling
keeps full handoff WIP unless the direct-pass exception applies and normal
proof, logging, and review complete.

## Planning-Time Structural State Preflight
Before roadmap planning, phase planning, or briefing implementation/refactor/governance repair
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

SaltMarcher keeps review instructions in global skills, not in this standard.
Mandatory subagent use is standing user authorization for the named role.

- Handoff uses `coord-adversarial-review`, `coord-main-overview`, one Overview
  coordinator, `coord-overview-reviewer`, and specialist `lens-*` skills after
  `lens-adversarial-review-agent`.
- Overview owns reviewer/follow-up launch, reviewability, fix outcomes, and
  final clean-or-blocked status. Not-reviewable or blocked results keep the
  pass WIP until fixed, freshly proved, and reviewed again.
- Overview is a completion gate: it checks original goal, Done When,
  architecture/quality objectives, proof oracle, and project-health baseline
  admission. Green proof is necessary but insufficient.
- Architecture, refactor, governance, state-ownership, system-of-record,
  adapter/seam, repeated-fix, or Clean-Break work includes the architecture
  lens or reports `WIP - Review Panel Blocked`; add quality/smell/simplicity
  lenses when complexity risk remains.
- When Structural State Review is triggered, Overview must include a fresh
  architecture-lens matrix. Missing, incomplete, contradicted, unresolved
  `Handoff Blocker`, or unsynchronized `Materialization Required` rows prevent
  `Clean`.
- Objective-relevant residual debt blocks handoff until fixed, user-excluded,
  or reported WIP/blocker. Incidental supported debt may be materialized only
  through project-health.
- Required proof tools run only at top-level handoff. Reviewers inspect literal
  proof and report missing/stale proof. If reviewed paths or behavior change,
  Main reruns proof and launches a fresh coordinator.
- Global review specialist skills remain supplementary lenses; do not create
  repo-local copies unless the user explicitly asks for a SaltMarcher fork.

## Qualitative Simplification Pass

SaltMarcher uses `code-simplifier` as a qualitative review-agent coordinator,
not as an implementation-agent self-check. Covered implementation passes run the
installed skill after the main edit and before pass logging. It reviews
simplicity, elegance, smells, and performance; consolidates safe patches or a
no-op result; and keeps reviewers read-only unless Main assigns a scoped fix.
It must not create static-analysis gates, weaken proof, replace Overview
handoff review, or claim full handoff coverage. If it changes repo-tracked
files, Main reruns required proof before Overview.

Main owns disposition of the code-simplifier result. A covered pass is ready for
Overview only after Main has read the current code-simplifier pass log or worker
report and handled every finding as fixed with proof rerun, assigned to a
same-run worker, planner-integrated, explicitly user-excluded, blocked/WIP, or
closed as false-positive/review-owned with evidence. Findings become blocking
same-run implementation tasks. `Deferred`, `follow-up`, `later`, `outside write
set`, or unowned `review-owned` findings block Overview. Overview inspects the
code-simplifier log with implementation logs.

`code-simplifier` may surface structural smells, but it cannot by itself close
architecture, state-ownership, or system-of-record risk. Any code-simplifier
finding in a structural-state family must be disposed as fixed, architecture
review blocker, planner-integrated, project-health materialized,
user-excluded, or false positive with code evidence before Overview readiness.

## Planner Escalation For Systemic Feedback

When review, architecture-check, behavior-harness, or proof feedback indicates
a systemic problem rather than a local defect, Main obtains a project-health
repair plan from the global planner before repair. The planner optimizes for
target architecture and maintainability, not the shortest immediate unblocker.

The Blocker Reflection Gate must run before this escalation decision. A blocker
classified as `Target Architecture Violation`, `Stale Or Over-Broad Gate`,
`Governance Gap`, or `Unclear Root Cause` is systemic unless source-backed
evidence proves it is an isolated local defect.

Escalate when root cause is unclear, the same surface has repeated fix cycles,
the finding suggests architecture/check/harness mismatch, the repair crosses
multiple owners, or a quick local fix would damage the target design. Do not
escalate isolated obvious single-surface fixes such as stale references or
one-file documentation corrections.

Main gives only neutral evidence: task goal, literal finding or output, changed
paths, owner documents, proof state, dirty baseline, constraints, and non-goals.
The planner returns root cause, target-state alignment, chosen approach,
rejected shortcuts, write set, proof route, risks, and Done When criteria. It
does not implement, review, run proof, launch workers, or replace Overview.

## Problem History Intake

For non-trivial bug, regression, refactor, governance, systemic-repair, or
repeated-fix work, Main MUST inspect pass logs before planning. Run `rg` in
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
architecture, domain truth, or verification policy. Roadmaps, wave plans,
implementation logs, review logs, completion audits, filenames, field lists,
and link rules live in
`docs/project/architecture/implementation-documentation.md`.

- Implementation agents must write one implementation pass log after each
  repo-tracked implementation pass and before starting the required Overview
  handoff review.
- Review agents must read relevant implementation, code-simplifier, and review
  pass logs before final review status.
- Nested specialist reviewers remain read-only and include pass-log evidence
  and trend observations in their reviewer output.
- The required review pass log is an aggregated Overview review cycle log. The
  main handoff agent writes it after each completed Overview review cycle from
  the Overview result and reviewer outputs. If nested review orchestration is
  unavailable and the main agent runs the top-level fallback review route, the
  main handoff agent writes the aggregated review pass log from the direct
  reviewer outputs.
- Pass logs live under `build/agent-pass-logs/` and are generated local
  evidence. Do not commit them and do not cite them as canonical truth.
- Pass logs are also local memory for expected wait times. Agents MUST follow
  the wait-time procedure in `implementation-documentation.md` and record
  observed durations for recurring long checks they run.
- Missing pass logs for prior work do not block a pass by themselves, but a
  required current implementation or review pass without its log remains WIP
  until the log is written or the blocker is reported.
- If the build directory was cleaned, missing logs are unavailable history, not
  evidence that no prior loop or degradation occurred.

## Stable-State Barrier For Waiting Agents

When Main is waiting for an implementation, proof, review, or simplification
agent that may still change the target write set, Main MUST treat that target
as unstable until the agent finishes, is explicitly cancelled, or reports that
it will make no further file changes.

While the target is unstable, Main MUST NOT start proof, quality analysis,
review, code-simplifier, production-handoff, desktop-install, or other sidecar
work against the same checkout or behavior surface. Main may only do clearly
independent work, such as reading governance, updating an explicitly requested
non-overlapping instruction document, checking a launched process, or waiting.

Before launching any proof, review, or expensive local tool after a wait, Main
MUST refresh the active coordination state: current user instruction, active
agent status, worktree dirty paths, and whether any open agent owns files or
behavior that the proposed tool would inspect. If any active agent can still
change that surface, defer the tool until the agent result is integrated or the
agent is cancelled. After an interruption, user correction, resume, or context
compaction, Main MUST repeat this refresh before continuing the workflow.
Resume summaries, pass-log summaries, and remembered skill lists are orientation only.
Before any new repo-tracked edit after interruption, Main MUST rerun
`context-hygiene`, read the nearest owner, or state that no edit is being made.

If Main intentionally runs independent work while waiting, it must name the
independence boundary before starting and must not claim the result as evidence
for the unstable target surface.

Implementation artifact filenames, headings, timestamp metadata, content
fields, code-simplifier evidence, wait-time observations, and Implementation
Reading Packet fields are owned by the Implementation Documentation Standard.
Do not duplicate those field lists in instruction surfaces or repo skills.

When a review agent sees a systemic trend instead of an isolated defect, it
must report that trend explicitly. If the trend suggests an architecture-model,
governance, skill, or mechanical-check change, the review reports it as a
blocking finding. Main integrates the repair into the same run.

## Verification Path

- Covered Markdown-only instruction changes that stay inside the documentation
  gate scope use `./gradlew checkDocumentationEnforcement --console=plain`.
- Covered instruction-only changes that also include `agents/openai.yaml` use
  `./gradlew checkDocumentationEnforcement --console=plain` for the Markdown
  instruction surfaces plus explicit derived-metadata consistency review
  against the governing `SKILL.md`.
- Covered changes that also touch non-Markdown code, Gradle, build logic, or
  non-covered surfaces still follow the broader verification path owned by
  `AGENTS.md` and the quality-platform standards.
- `agents/openai.yaml` is governed by this standard but is not itself part of
  the Markdown-focused documentation gate scope.

## Ownership Rules

- `AGENTS.md` owns project-wide norms only.
- `AGENTS.md` must stay an early router: it names mandatory triggers,
  canonical owners, and repo-specific verification surfaces, but it must not
  become a glossary, feature spec, migration plan, or second copy of a layer
  standard.
- `SKILL.md` owns reusable agent workflow and trigger logic for one skill.
- `docs/project/<type>/*.md` own reusable project-wide rules for one
  topic.
- Other instruction markdown may exist only when the topic is narrower than a
  reusable standard or skill.

If multiple covered surfaces start repeating the same rule, move the rule to
the lowest stable canonical owner and replace the others with short summaries or
links.

## Review Rules

When a covered artifact changes, reviewers must check:

- Was the global instruction skill used?
- Does the edited file still own the right topic, without duplicate or
  conflicting truth, and did neighboring instruction metadata such as
  `agents/openai.yaml` stay aligned?
- Does the chosen verification path match the actual changed surfaces?
- For behavior-changing work, did the pass cover the owning harness and
  dependencies, including negative assertions against the reported old
  behavior, or report a concrete `Harness Gap` blocker?
- Did covered implementation work run `code-simplifier` before pass logging and
  Overview review, read its result, and dispose every finding before any
  handoff-readiness claim?
- For Standard Coordinated Workflow, did phase ownership, clean-start
  subagents, and WIP/tooling blockers stay explicit?
- When proof, review, architecture, quality, harness, or gate feedback blocked
  the pass, did Main run the Blocker Reflection Gate before planning a repair,
  classify the blocker, compare the target-architecture repair against the
  shortest local unblocker, obtain planner escalation for systemic feedback,
  and record the rejected shortcut?
- For covered repeated or non-trivial work, did Main inspect related pass-log
  history before planning and avoid repeating failed surface fixes without a
  deeper root-cause plan?
- For stateful planning or refactor work, did Main run or explicitly classify
  Planning-Time Structural State Preflight before the implementation plan or
  wave-plan artifact, and did every non-clean row receive an allowed
  disposition?
- Did the implementing agent obtain a completed global `lens-coordinator-handoff`
  coordinator result before handoff?
- Did the Overview result include an objective-completion verdict, baseline
  admission disposition, required architecture/quality lens coverage, and a
  global final status rather than treating green proof as sufficient?
- For stateful or user-reported bugs, did review verify that the proof oracle
  makes the old failure impossible instead of only proving a new happy path?
- Did any specialist review skill used for the pass remain a read-only review
  lens instead of becoming a competing repo-owned workflow?
- Did implementation and review agents write and use required local pass logs?
- Did local baseline admission check fresh proof/review, marker/register sync,
  active debt intake, pass-log trends, and no hidden supported findings?
