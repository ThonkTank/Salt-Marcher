Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-06-18
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

## Review Skill Routing

SaltMarcher keeps review instructions in global skills, not in this standard.
Mandatory subagent use is standing user authorization for the named role.

- Implementing agents use the global caller stack:
  `coord-adversarial-review` before review and `coord-main-overview` when
  launching the one required Overview coordinator for implementation handoff.
- Overview uses the global adversarial, coordinator, handoff, and
  `coord-overview-reviewer` skills.
- Specialist reviewers first use `lens-adversarial-review-agent`, then their
  assigned `lens-*` skill.
- Overview owns reviewer launch, scoped follow-up launch, reviewability,
  specialist outcomes, fix outcomes, and the final clean-or-blocked result. If
  it returns not-reviewable or blocked, the pass remains WIP until fixed and
  reviewed again.
- Required proof tools run only at the top-level handoff layer. Reviewers
  inspect provided literal proof and report missing or stale proof instead of
  rerunning it. If reviewed paths or behavior change, Main reruns proof and
  launches a fresh coordinator.
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

## Planner Escalation For Systemic Feedback

When review, architecture-check, behavior-harness, or proof feedback indicates
a systemic problem rather than a local defect, Main obtains a project-health
repair plan from the global planner before repair. The planner optimizes for
target architecture and maintainability, not the shortest immediate unblocker.

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

## Implementation And Review Pass Logs

SaltMarcher uses local pass logs as generated operational evidence for
detecting repeated loops, reversals, quality drift, and architecture friction.
They are not canonical documentation and must not redefine requirements,
contracts, architecture, domain truth, or verification policy.
Detailed artifact fields live in
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
- Pass logs are also local memory for expected wait times. Agents MUST record
  observed durations for recurring harnesses, staged verification routes,
  desktop installation, and other long checks they run.
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

Implementation and review pass-log filenames, headings, timestamp metadata,
content fields, code-simplifier evidence, wait-time observations, and
Implementation Reading Packet fields are owned by the Implementation
Documentation Standard. Do not duplicate those field lists in instruction
surfaces or repo skills.

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
- Does the edited file still own the right topic?
- Did a neighboring instruction source also require an update?
- Does `agents/openai.yaml` still match the governing skill?
- Did the change introduce duplicate or conflicting truth?
- Did supported project-health findings become fixed, false positive,
  user-excluded, WIP/blocker, or synchronized marker/register entries?
- Does the chosen verification path match the actual changed surfaces?
- For behavior-changing work, did the pass cover the owning harness and
  dependencies or report a concrete `Harness Gap` blocker?
- Did covered implementation work run `code-simplifier` before pass logging and
  Overview review, without treating it as a substitute for proof?
- Did Main read the code-simplifier pass log and dispose every finding before
  Overview or any handoff-readiness claim?
- Did Overview block unclassified `deferred`, `follow-up`, `later`, `outside
  write set`, or unowned `review-owned` improvement findings?
- If systemic review, architecture-check, behavior-harness, or proof feedback
  shaped the repair, did Main obtain a planner project-health plan before
  implementing the fix?
- For covered repeated or non-trivial work, did Main inspect related pass-log
  history before planning and avoid repeating failed surface fixes without a
  deeper root-cause plan?
- Did the implementing agent obtain a completed global `lens-coordinator-handoff`
  coordinator result before handoff?
- Did any specialist review skill used for the pass remain a read-only review
  lens instead of becoming a competing repo-owned workflow?
- Did implementation and review agents write and use required local pass logs?
- Did the review inspect pass logs for repeated reversals, loops, degradation,
  architecture friction, recurring smells, or governance/check misses?
- Did local baseline admission check fresh proof, fresh review, marker/register
  sync, and no supported findings hidden only in pass logs?

## References

- [Architecture Overview](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/overview.md:1)
- [Documentation Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/documentation.md:1)
- [Agent Context Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/agent-context.md:1)
- [Implementation Documentation Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/implementation-documentation.md:1)
- [Project Health Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/project-health.md:1)
- [Layering Architecture Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/layering-architecture.md:1)
- [Global Agent Instruction Engineering Skill](/home/aaron/.codex/skills/local/agent-instruction-engineering/SKILL.md:1)
- [Global Main To Overview Coordination Skill](/home/aaron/.codex/skills/local/coord-main-overview/SKILL.md:1)
- [Global Overview To Reviewer Coordination Skill](/home/aaron/.codex/skills/local/coord-overview-reviewer/SKILL.md:1)
- [Global Coordinator Lens](/home/aaron/.codex/skills/local/lens-coordinator/SKILL.md:1)
- [Global Handoff Coordinator Lens](/home/aaron/.codex/skills/local/lens-coordinator-handoff/SKILL.md:1)
- [Global Adversarial Review Caller Skill](/home/aaron/.codex/skills/local/coord-adversarial-review/SKILL.md:1)
- [Global Adversarial Review Agent Skill](/home/aaron/.codex/skills/local/lens-adversarial-review-agent/SKILL.md:1)
- [Installed Code Simplifier Skill](/home/aaron/.codex/plugins/cache/claude-plugins-official/code-simplifier/1.0.0/agents/code-simplifier.md:1)
- [Global Planner Skill](/home/aaron/.codex/skills/local/planner/SKILL.md:1)
