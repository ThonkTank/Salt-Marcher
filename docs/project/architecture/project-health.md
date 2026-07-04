Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-06-30
Source of Truth: Project-health ownership, debt materialization, and local
baseline-admission rules for known structural and quality problems.

# Project Health

## Goal

Known structural, architecture, governance, and quality problems must be
discoverable where they hurt the code and searchable from one register. Pass
logs are evidence for how a problem was found; they are not the only acceptable
home for a known problem.

This standard defines project-health debt handling. It does not replace layer
architecture standards, behavior harness proof, verification policy, or the
`LEGACY_REMOVE_ON_TOUCH` delete signal.

## Owner Areas

An owner area is an agent expertise packet, not a human code-owner team. It is
the smallest stable surface whose docs, skills, review lenses, and failure
patterns let an agent judge whether a change improves or damages the target
architecture.

Owner areas must have:

- a canonical owner document or a clear routing document
- one operative skill when agents need repeatable workflow guidance
- review checklists for common drift, forbidden adapters, and single-source
  rules
- a verification or review-owned proof statement

Use existing areas before adding new ones. Add or split an owner area only when
one current area owns two concerns that now need different target rules,
different proof routes, or different reviewer expertise. Merge or reroute an
area when its rules have become only a thin duplicate of another owner.

## Code Health

Code health is the repository's ability to keep changing safely without
normalizing structure that future agents will copy. A change improves code
health when it removes a target-architecture violation, reduces owner, DTO, or
adapter duplication while preserving behavior, or turns known hidden debt into
owned repair work with a concrete removal condition.

A change worsens code health when it introduces or preserves unowned
compatibility seams, duplicated facts, generic routers, semantic View state,
unowned carriers, self-confirming harnesses, stale proof wording, or target
architecture drift without a marker and register entry.

Gate-shaped workarounds are project-health problems when a repair satisfies a
check, harness, or review phrase while making the target structure less clear.
Examples include replacing typed state with a raw protocol only to pass a layer
rule, moving interpretation to a different class without removing duplicated
semantics, changing production code to satisfy a stale or over-broad gate, or
closing a blocker without recording the rejected cleaner repair. A green gate
after such a workaround is not a code-health improvement by itself.

Self-confirming harnesses are project-health problems when proof demonstrates a
new route or fixture but would still pass if the reported old failure,
duplicated state source, stale projection, fallback mutation path, or wrong
visual affordance remained. For user-reported defects, a harness must include a
negative assertion tied to the old failure before its green result can support
baseline admission.

Structural-state debt is a project-health family when it is supported by code
evidence and cannot be fixed in the same pass. Examples include duplicated
system-of-record facts, unclear state ownership, competing mutation paths,
stringly typed boundary protocols, encoded UI values, `null` used as a domain
state, placeholder concepts flattened into absence, view draft state acting as
truth, snapshot reconstruction of facts a command does not own, and duplicated
enum or type literals.

Green tests and successful gates are necessary proof for behavior and policy.
They are not by themselves a code-health verdict.

Planning for stateful work must actively inspect the structural-state family
before implementation planning is considered complete. Planning-Time Structural
State Preflight is owned by the Agent Instruction Standard; project-health owns
the disposition of supported non-clean rows that cannot be fixed inside the
current objective or must remain discoverable after the pass.

When a blocker triggers the Agent Instruction Standard's Blocker Reflection
Gate, project-health owns the disposition of any finding classified as target
architecture violation, stale or over-broad gate, governance gap, repeated
quick-fix family, or gate-shaped workaround.

Decisions, blockers, and insights first recorded in roadmaps, wave plans, or
pass logs become project-health concerns when they affect future planning,
baseline admission, owner boundaries, proof trust, or repeated work. Keep them
linked from the roadmap while active, and materialize durable structural or
governance debt through this standard before handoff instead of leaving it only
in generated logs.

## Debt Marker

Use `PROJECT_HEALTH_DEBT` for known structural or governance debt that cannot
be fixed in the same pass. The marker format is:

```text
PROJECT_HEALTH_DEBT[PH-YYYYMMDD-NNN]: <problem>; owner=<area>; remove_when=<concrete condition>.
```

Place the marker at the primary cause. When several files are affected, mark
the primary cause and list satellite paths in the register. The marker must be
close enough that an agent editing the affected area sees it without opening a
central log.

`LEGACY_REMOVE_ON_TOUCH` remains the targeted delete signal for legacy or
compatibility support that must be removed when touched. Use
`PROJECT_HEALTH_DEBT` when the problem is broader than a local delete signal or
must be tracked centrally across areas, skills, or review governance.

## Register

The central register is
[Project Health Debt Register](docs/project/architecture/project-health-debt.md:1).

Every marker ID must have exactly one register entry. Every register entry must
have a marker unless it documents a pure process or tooling problem with no
honest code or document location. Markerless entries must state `Marker: none`
and explain why no local marker is meaningful.

Each register entry records:

- problem
- owner areas
- affected paths or symbols
- intake trigger
- resolution mode
- resolver status
- required next action
- source pass log or discovery evidence
- decision
- removal condition
- current status

## Automatic Debt Intake

Materialized project-health debt is active work, not archival metadata. Open
debt returns to the working scope automatically when a later pass supplies a
matching repo-relative path or owner area named by the register's
`Intake Trigger`, `Affected Paths`, `Owner Areas`, or marker.
The wrapper does not infer symbols or concepts from source content.

The default resolution mode is `Next Matching Touch`. Existing entries without
explicit resolver fields are treated as `Resolution Mode: Next Matching Touch`
and `Resolver Status: Open`. When debt intake matches the current scope, Main
must resolve it in the same pass, close it as false positive with evidence,
obtain explicit user exclusion, or report a WIP/blocker before continuing to a
handoff-ready state.

Debt that belongs to the current user's stated objective is not incidental
baseline. It blocks completion until fixed, explicitly user-excluded, or
reported as WIP/blocker. Marker/register materialization may preserve
incidental supported debt outside the objective; it must not convert unfinished
objective work into a clean handoff.

Use `tools/quality/reporting/project_health_scan.py --intake` with
`--planned-path`, `--planned-owner`, or `--worktree` to check planned scope.
The staged verification wrappers run intake-only before `production-handoff`
for current changed worktree paths and before `focused-handoff` for focused
paths and explicit focused areas; a matching active debt entry fails the
wrapper before Gradle starts. Wrapper worktree intake is path-only. Owner-area
debt intake remains a planning and handoff responsibility through explicit
`--planned-owner` selectors.
Register list fields use comma-separated tokens. Path tokens are matched
case-sensitively; owner-area tokens are matched case-insensitively.

### Resolver Dispositions

Use these register transitions when intake or review closes a debt item:

| Outcome | Marker | Register Section | Status | Resolution Mode | Resolver Status |
| --- | --- | --- | --- | --- | --- |
| Fixed or removed | remove marker | Removed Or Closed Debt | Removed | Next Matching Touch | Resolved |
| False positive | remove marker, or keep `Marker: none` for markerless process entries | Removed Or Closed Debt | False Positive | Next Matching Touch | False Positive |
| Superseded | replace marker with the new debt ID when one exists | Removed Or Closed Debt | Superseded | Next Matching Touch | Superseded |
| Explicit user exclusion | keep marker unless the user excludes a markerless process entry | Active Debt | Open | User Excluded | User Excluded |
| Blocked or WIP | keep marker | Active Debt | Open | Next Matching Touch | Blocked |

Only entries whose status or resolver status is closed, or whose resolution mode
is `User Excluded`, are inactive for automatic intake. `Blocked` remains active
and must be reported as WIP when matched.

## Review Governance

Before planning or reviewing stateful owner areas, Main must inspect
structural-state risk directly rather than only searching for already named
debt terms. The inspection must classify whether the preflight was triggered
and must dispose every non-clean row as fixed in plan, `Plan Must Address`,
`Planning Blocker`, incidental project-health debt, or explicit user exclusion.
Unsupported suspected rows are recorded as `Clean` or `Not Triggered` with code
evidence; false positive remains a supported-finding or review disposition, not
a planning matrix row.

Every repo-tracked implementation review must search the reviewed scope for:

```text
PROJECT_HEALTH_DEBT
LEGACY_REMOVE_ON_TOUCH
temporary compatibility
retained compatibility
stale
deferred
review-owned
outside write set
proof oracle
self-confirming harness
missing negative assertion
gate-shaped workaround
quick local unblock
raw protocol fallback
rejected shortcut
stringly typed protocol
encoded UI value
null domain state
duplicated system of record
view draft truth
snapshot reconstruction
duplicated type literal
parallel mutation path
```

Supported findings must not remain only in a pass log. Main or Overview must
close each one as fixed, false positive with evidence, user-excluded, WIP
blocker, or materialized `PROJECT_HEALTH_DEBT` with register entry and removal
condition. A pass with newly recognized structural residual debt, including a
Structural State Ownership Matrix row classified as `Materialization Required`,
is not handoff-ready until marker and register are synchronized and the row is
reclassified as `Materialized`, or the user explicitly excludes the debt.

When expertise is missing, record a skill gap or project-health debt. Do not
treat missing expertise as approval.

## Repetition Detection

Use `tools/quality/reporting/project_health_scan.py` as the read-only review
helper for marker/register sync, automatic debt intake, and repeated pass-log
terms. A review must run it for the current scope or explain why no
project-health surface is touched.

The second occurrence of the same debt family in a touched owner area triggers
Planner or project-health review before another local fix loop. Families can be
symbol names, marker IDs, owner areas, or repeated terms such as stale proof,
proof oracle, self-confirming harness, missing negative assertion, retained
compatibility, source-edge carriers, generic preview, gate-shaped workaround,
quick local unblock, raw protocol fallback, rejected shortcut, stringly typed
protocol, null domain state, view draft truth, snapshot reconstruction,
duplicated type literal, parallel mutation path, or deferred review-owned
findings.

## Baseline Admission

Before commit or push, Main checks local baseline admission:

- final diff still matches the reviewed scope
- proof is fresh for the final diff
- Overview is fresh for the final diff
- Overview includes an objective-completion verdict for the original goal and
  Done When criteria
- user-reported defect proof includes negative assertions that make the old
  failure impossible
- `PROJECT_HEALTH_DEBT` markers and register entries are synchronized
- active matching debt has an intake disposition
- supported findings are not only buried in pass logs
- objective-relevant structural debt is fixed, explicitly user-excluded, or
  held as WIP/blocker rather than materialized as incidental baseline
- blocker-driven repairs record the Blocker Reflection Gate classification,
  rejected shortcut, and why the chosen repair improves or preserves target
  architecture and project health
- triggered Structural State Ownership Matrix rows are complete, and no
  `Planning Blocker`, `Handoff Blocker`, or unresolved
  `Materialization Required` row remains
- touched scope contains no unowned compatibility seam

This is the local equivalent of deciding whether the change may become project
baseline. It is not a replacement for proof, Overview, or the workspace commit
rules.

## References

- [Project Health Debt Register](docs/project/architecture/project-health-debt.md:1)
- [Agent Instruction Standard](docs/project/architecture/agent-instructions.md:1)
- [Agent Context Standard](docs/project/architecture/agent-context.md:1)
- [Documentation Standard](docs/project/architecture/documentation.md:1)
- [Quality Platforms](docs/project/verification/quality-platforms.md:1)
