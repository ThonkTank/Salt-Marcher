Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-06-22
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

Green tests and successful gates are necessary proof for behavior and policy.
They are not by themselves a code-health verdict.

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
[Project Health Debt Register](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/project-health-debt.md:1).

Every marker ID must have exactly one register entry. Every register entry must
have a marker unless it documents a pure process or tooling problem with no
honest code or document location. Markerless entries must state `Marker: none`
and explain why no local marker is meaningful.

Each register entry records:

- problem
- owner areas
- affected paths or symbols
- source pass log or discovery evidence
- decision
- removal condition
- current status

## Review Governance

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
```

Supported findings must not remain only in a pass log. Main or Overview must
close each one as fixed, false positive with evidence, user-excluded, WIP
blocker, or materialized `PROJECT_HEALTH_DEBT` with register entry and removal
condition. A pass with newly recognized structural residual debt is not
handoff-ready until marker and register are synchronized.

When expertise is missing, record a skill gap or project-health debt. Do not
treat missing expertise as approval.

## Repetition Detection

Use `tools/quality/reporting/project_health_scan.py` as the read-only review
helper for marker/register sync and repeated pass-log terms. A review must run
it for the current scope or explain why no project-health surface is touched.

The second occurrence of the same debt family in a touched owner area triggers
Planner or project-health review before another local fix loop. Families can be
symbol names, marker IDs, owner areas, or repeated terms such as stale proof,
retained compatibility, source-edge carriers, generic preview, or deferred
review-owned findings.

## Baseline Admission

Before commit or push, Main checks local baseline admission:

- final diff still matches the reviewed scope
- proof is fresh for the final diff
- Overview is fresh for the final diff
- `PROJECT_HEALTH_DEBT` markers and register entries are synchronized
- supported findings are not only buried in pass logs
- touched scope contains no unowned compatibility seam

This is the local equivalent of deciding whether the change may become project
baseline. It is not a replacement for proof, Overview, or the workspace commit
rules.

## References

- [Project Health Debt Register](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/project-health-debt.md:1)
- [Agent Instruction Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/agent-instructions.md:1)
- [Agent Context Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/agent-context.md:1)
- [Documentation Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/documentation.md:1)
- [Quality Platforms](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/verification/quality-platforms.md:1)
