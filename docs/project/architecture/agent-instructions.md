Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-06-14
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

- Implementing agents read
  `/home/aaron/.codex/skills/local/coord-adversarial-review/SKILL.md` before
  starting the mandatory adversarial review step and use
  `/home/aaron/.codex/skills/local/coord-main-overview/SKILL.md` when launching
  the Overview coordinator.
- For implementation handoff, the implementing agent must launch one Overview
  coordinator subagent. That Overview coordinator first reads
  `/home/aaron/.codex/skills/local/lens-adversarial-review-agent/SKILL.md`,
  then uses `/home/aaron/.codex/skills/local/coord-adversarial-review/SKILL.md`
  and `/home/aaron/.codex/skills/local/lens-coordinator/SKILL.md` before
  applying the Main-assigned coordinator lens, normally
  `/home/aaron/.codex/skills/local/lens-coordinator-handoff/SKILL.md`.
  Before launching specialist reviewers, the Overview coordinator uses
  `/home/aaron/.codex/skills/local/coord-overview-reviewer/SKILL.md`.
- The Overview coordinator returns the reviewability decision, responsibility
  slices, required specialist skills, specialist review outcomes, scoped
  follow-up fix outcomes, and the final clean-or-blocked result.
- The Overview coordinator owns nested specialist review launches and scoped
  follow-up worker launches. If the Overview result says the change is not
  reviewable or remains blocked, the pass remains WIP until the named blocker
  is fixed and Overview is rerun.
- Specialist review subagents read
  `/home/aaron/.codex/skills/local/lens-adversarial-review-agent/SKILL.md`
  before applying assigned `lens-*` skills.
- Proof ownership follows the global `coord-adversarial-review` skill and the
  repository verification routing. Required proof tools run at the top-level
  handoff layer. Overview coordinators and specialist reviewers inspect
  provided literal results and report missing or stale proof instead of
  rerunning those tools. The top-level handoff agent must keep reviewed paths
  and behavior stable while review is running, or rerun the required proof and
  launch a fresh coordinator when the tested surface changes.
- The global review specialist skills remain external supplementary lenses; do
  not create repo-local copies unless the user explicitly asks for a
  SaltMarcher-owned fork.

## Qualitative Simplification Pass

SaltMarcher uses `code-simplifier` as a fixed qualitative step in the active
implementation workflow. It is an in-agent orchestrator over the global
simplicity, elegance, smell, and performance lenses. It finds local
behavior-preserving simplification patches for inefficiencies that mechanical
static-analysis gates do not cover.

Implementation agents must run the installed `code-simplifier` skill after the
main edit and before writing the implementation pass log when the pass changes
production code, check/enforcement packages, build or verification wiring,
dependency surfaces, or agent-facing instruction surfaces. If the harness does
not auto-discover the skill, read and apply:

- `/home/aaron/.codex/plugins/cache/claude-plugins-official/code-simplifier/1.0.0/skills/code-simplifier/SKILL.md`

The simplification pass must not create new static-analysis gates, weaken
required proof, replace the mandatory Overview-coordinated review, or launch
review subagents by default. It may produce a small local patch, record that no
safe simplification was found, or downgrade a risky idea to a review note.

## Planner Escalation For Systemic Feedback

SaltMarcher treats large review, architecture-check, behavior-harness, and
proof blockers as planning inputs before repair. When feedback suggests a
systemic problem rather than a local defect, Main must obtain a
project-health repair plan from the global planner before implementing the
repair. The planner optimizes for the long-term target architecture,
maintainability, and fitting solution shape, not for the shortest immediate
unblocker.

Planner escalation is required when any of these signals appear:

- the root cause is unclear after the literal finding or harness output is
  inspected
- the same behavior, check, or proof surface has required repeated fix cycles
- the finding suggests an architecture, check, or behavior-harness mismatch
- a repair likely touches multiple owner surfaces, packages, documents, checks,
  or generated surfaces
- a quick local fix would satisfy the immediate finding while making the target
  design less direct, less cohesive, or harder to maintain

Planner escalation is not required for isolated local issues with an obvious
single-surface fix, such as typos, missing imports, stale references, or
one-file documentation corrections.

Main gives the planner only neutral, inspectable evidence: task goal, literal
finding or harness output, current changed paths, owner documents, proof state,
dirty baseline, constraints, and known non-goals. The planner returns a concise
project-health plan with root cause, target-state alignment, chosen approach,
rejected short-cuts, write set, proof route, risks, and Done When criteria. The
planner does not implement, review, run proof, launch workers, or replace the
Overview coordinator.

## Implementation And Review Pass Logs

SaltMarcher uses local pass logs as generated operational evidence for
detecting repeated loops, reversals, quality drift, and architecture friction.
They are not canonical documentation and must not redefine requirements,
contracts, architecture, domain truth, or verification policy.

- Implementation agents must write one implementation pass log after each
  repo-tracked implementation pass and before starting the required Overview
  handoff review.
- Overview coordinators and specialist review agents must read the relevant
  available implementation and review pass logs before classifying final review
  status.
- Nested specialist reviewers remain read-only. They must not write files
  directly; they include pass-log evidence and trend observations in their
  reviewer output.
- The required review pass log is an aggregated Overview review cycle log. The
  main handoff agent writes it after each completed Overview review cycle from
  the Overview result and reviewer outputs. If nested review orchestration is
  unavailable and the main agent runs the top-level fallback review route, the
  main handoff agent writes the aggregated review pass log from the direct
  reviewer outputs.
- Pass logs live under `build/agent-pass-logs/` and are generated local
  evidence. Do not commit them and do not cite them as canonical truth.
- Pass logs are also the local memory for expected wait times of recurring
  long-running processes. Agents MUST record observed durations for frequently
  repeated harnesses, staged verification routes, desktop installation, and
  other long checks they run so later agents can choose sensible polling
  intervals.
- Missing pass logs for prior work do not block a pass by themselves, but a
  required current implementation or review pass without its log remains WIP
  until the log is written or the blocker is reported.
- If the build directory has been cleaned, reviewers treat the missing logs as
  unavailable operational history rather than as evidence that no prior loop or
  degradation occurred.

## Wait-Time And Polling Evidence

Agents SHOULD avoid tight polling of known long-running processes. Before
waiting on a recurring SaltMarcher process, inspect the newest relevant local
pass log or retained Gradle run log when available and use its last observed
duration as the expected wait time.

- If a previous comparable run took several minutes, schedule the first
  completion poll near that observed duration instead of polling every few
  seconds.
- For example, when the latest comparable harness run took about 10 minutes,
  the next agent should wait about 10 minutes before the first completion poll,
  unless the process emits meaningful incremental output that needs immediate
  triage.
- If no prior duration exists, use the observable wrapper output or normal
  30-60 second status intervals until the process class has one recorded
  duration.
- After the expected wait time has elapsed, poll at a moderate interval
  such as 30-60 seconds until completion or failure.
- Do not launch duplicate Gradle, harness, or verification processes merely
  because a known long-running process is quiet.

Implementation and review pass logs MUST include a `Wait-Time Observations`
entry whenever the pass ran a recurring process that took long enough to affect
agent polling behavior. Each entry records the command or process class,
observed elapsed time, result, evidence log path when one exists, and the
recommended first-poll interval for the next comparable run.

Implementation log filenames must use:

- `build/agent-pass-logs/YYYY-MM-DD-<kebab-task-slug>-implementation.md`

Review aggregation log filenames must use:

- `build/agent-pass-logs/YYYY-MM-DD-<kebab-task-slug>-review.md`

Use the local calendar date from the log timestamp. If the exact filename
already exists for a later same-day pass, append `-2`, `-3`, or the next
integer before the suffix. Each log must start with one of these headings:

- `# Implementation Pass Log: <task summary>`
- `# Review Pass Log: <task summary>`

The first metadata line must be `Timestamp: YYYY-MM-DD HH:MM:SS TZ +HHMM`,
using the local time, named timezone, numeric offset, and exact time the log is
written. Include `Parent Pass Log:` or `Related Pass Logs:` when the pass
continues, reviews, or fixes known prior work.

An implementation pass log must include:

- exact local timestamp, actor role, task goal, and scope boundary
- parent or related pass-log paths when known
- touched paths and intentionally untouched dirty paths
- owner documents and mandatory skills used
- implementation summary and key tradeoffs
- `code-simplifier` outcome for covered implementation passes, including safe
  patches made, no-op result, or skipped status with reason
- planner escalation outcome when systemic review, architecture-check,
  behavior-harness, or proof feedback shaped the project-health plan
- `LEGACY_REMOVE_ON_TOUCH` markers found in the write set and whether they were
  removed or reported as blockers
- verification commands and literal results
- wait-time observations for recurring long-running processes, including
  recommended first-poll intervals for future comparable runs
- reversals, reimplemented work, abandoned approaches, or repeated edits to the
  same behavior
- architecture, quality, maintainability, elegance, or performance friction
  observed while implementing
- open blockers and review needs

A review pass log must include:

- exact local timestamp, Overview aggregation role or main fallback handoff
  role, reviewed scope, and reviewed pass-log paths
- verification evidence inspected
- wait-time evidence inspected or updated when review depends on long-running
  proof, harness, or installation processes
- selected review panel or unavailable nested-review blocker
- findings and fix outcomes
- trend observations, including repeated reversals, looped implementation,
  growing complexity, recurring smells, architecture loopholes, or repeated
  governance/check misses
- escalation recommendations when systemic governance, skill, check, or
  architecture changes may prevent recurrence
- final clean, blocked, or WIP status

When a review agent sees a systemic trend instead of an isolated defect, it
must report that trend explicitly. If the trend suggests an architecture-model,
governance, skill, or mechanical-check change, the review must classify it as a
separate systemic finding unless the user or current scope explicitly includes
that change.

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
- Did the change introduce duplicate or conflicting truth across covered
  surfaces?
- Does the chosen verification path match the actual changed surfaces?
- Did covered implementation work run `code-simplifier` before pass logging and
  Overview review, without treating it as a substitute for proof or review?
- If systemic review, architecture-check, behavior-harness, or proof feedback
  shaped the repair, did Main obtain a planner project-health plan before
  implementing the fix?
- Did the implementing agent obtain a completed global `lens-coordinator-handoff`
  coordinator result before handoff?
- Did any specialist review skill used for the pass remain a read-only review
  lens instead of becoming a competing repo-owned workflow?
- Did the implementation agent and Overview coordinator, or main fallback
  handoff agent, write and use the required local pass logs?
- Did the review inspect pass logs for repeated reversals, loops, degradation,
  architecture friction, recurring smells, or governance/check misses?

## References

- [Architecture Overview](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/overview.md:1)
- [Documentation Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/documentation.md:1)
- [Agent Context Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/agent-context.md:1)
- [Layering Architecture Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/layering-architecture.md:1)
- [Global Agent Instruction Engineering Skill](/home/aaron/.codex/skills/local/agent-instruction-engineering/SKILL.md:1)
- [Global Main To Overview Coordination Skill](/home/aaron/.codex/skills/local/coord-main-overview/SKILL.md:1)
- [Global Overview To Reviewer Coordination Skill](/home/aaron/.codex/skills/local/coord-overview-reviewer/SKILL.md:1)
- [Global Coordinator Lens](/home/aaron/.codex/skills/local/lens-coordinator/SKILL.md:1)
- [Global Handoff Coordinator Lens](/home/aaron/.codex/skills/local/lens-coordinator-handoff/SKILL.md:1)
- [Global Adversarial Review Caller Skill](/home/aaron/.codex/skills/local/coord-adversarial-review/SKILL.md:1)
- [Global Adversarial Review Agent Skill](/home/aaron/.codex/skills/local/lens-adversarial-review-agent/SKILL.md:1)
- [Installed Code Simplifier Skill](/home/aaron/.codex/plugins/cache/claude-plugins-official/code-simplifier/1.0.0/skills/code-simplifier/SKILL.md:1)
- [Global Planner Skill](/home/aaron/.codex/skills/local/planner/SKILL.md:1)
- [Global Performance Review Skill](/home/aaron/.codex/skills/local/lens-performance/SKILL.md:1)
- [Global Code Quality Review Skill](/home/aaron/.codex/skills/local/lens-quality/SKILL.md:1)
- [Global Architecture Review Skill](/home/aaron/.codex/skills/local/lens-architecture/SKILL.md:1)
