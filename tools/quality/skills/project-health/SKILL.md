---
name: project-health
description: Use before planning, implementing, refactoring, or reviewing SaltMarcher work that may introduce, discover, retain, or close structural debt, governance debt, compatibility seams, repeated fix loops, stale proof, or code-health tradeoffs.
---

# Project Health

## Purpose

Use this skill to prevent known architecture, quality, or governance problems
from becoming silent baseline. The canonical standard is
`docs/project/architecture/project-health.md`; the central register is
`docs/project/architecture/project-health-debt.md`.

This skill does not authorize new central Gradle gates. It defines review and
handoff workflow for materializing supported findings.

## Required Workflow

Before planning, implementing, refactoring, or reviewing covered work:

1. Read `docs/project/architecture/project-health.md`.
2. Identify the owner areas affected by the work and read their operative
   skills or owner documents.
3. Search the planned scope for `PROJECT_HEALTH_DEBT`,
   `legacy removal`, `temporary compatibility`,
   `retained compatibility`, `stale`, `deferred`, `review-owned`, and
   `outside write set`, `proof oracle`, `self-confirming harness`,
   `missing negative assertion`, `gate-shaped workaround`,
   `quick local unblock`, `raw protocol fallback`, and `rejected shortcut`.
   For stateful scopes, also
   search for structural-state debt families raised by review: stringly typed
   protocol, encoded UI value, null domain state, duplicated system of record,
   view draft truth, snapshot reconstruction, duplicated type literal, and
   parallel mutation path.
   Searching is not enough for stateful scopes: confirm whether Planning-Time
   Structural State Preflight from
   `docs/project/architecture/agent-instructions.md` is triggered, inspect the
   family directly, and keep every non-clean matrix row in the plan until it is
   fixed, assigned to a concrete slice, explicit blocker/WIP, incidental debt
   materialized through this workflow, or explicitly user-excluded. Unsupported
   suspected rows are recorded as `Clean` or `Not Triggered` with code evidence;
   false positive remains a supported-finding or review disposition, not a
   planning matrix row.
4. Run `python3 tools/quality/reporting/project_health_scan.py --intake` with
   at least one `--planned-path`, `--planned-owner`, or `--worktree` selector
   before treating the scope as handoff-ready. Matching active debt must be
   resolved, closed as false positive with evidence, explicitly user-excluded,
   or reported as WIP/blocker in the same pass.
5. Run `python3 tools/quality/reporting/project_health_scan.py` with the
   narrowest relevant `--scope` paths, or state why the pass has no
   project-health surface.
6. Classify supported findings as fixed, false positive with evidence,
   user-excluded, WIP/blocker, or materialized project-health debt.
   Supported debt that belongs to the current user's objective is not eligible
   for materialization as incidental baseline; fix it, obtain explicit user
   exclusion, or keep the pass WIP/blocked.
   When a proof, review, architecture, quality, harness, or gate blocker shaped
   the current repair, confirm that the Agent Instruction Standard's Blocker
   Reflection Gate classified the blocker before implementation planning and
   recorded the rejected quick fix. A target-architecture violation, stale or
   over-broad gate, governance gap, repeated quick-fix family, or gate-shaped
   workaround is a supported project-health finding until fixed, false-positive
   with evidence, user-excluded, WIP/blocked, or materialized when incidental.
   A user-reported defect with no negative proof assertion is a supported
   project-health finding until fixed, explicitly user-excluded, or WIP.
   A Structural State Ownership Matrix row classified as
   `Incidental Debt` during planning or `Materialization Required` during
   review is a supported finding for this workflow and must be synchronized and
   reclassified as `Materialized` before handoff-ready status. A
   `Planning Blocker` cannot be materialized into clean baseline status.
7. For materialized debt, add a local marker at the primary cause:
   `PROJECT_HEALTH_DEBT[PH-YYYYMMDD-NNN]: <problem>; owner=<area>; remove_when=<condition>.`
8. Add exactly one register entry in
   `docs/project/architecture/project-health-debt.md`.
9. For pure process or tooling debt with no honest local marker, add a register
   entry with `Marker: none` and the reason.
10. Materialized debt entries must include resolver fields. Use
    `Resolution Mode: Next Matching Touch` unless the user explicitly chooses a
    same-pass repair, scheduled repair, or exclusion. Register list fields must
    use comma-separated tokens; path tokens are case-sensitive and owner-area
    tokens are case-insensitive. Use `Affected Paths` for intake paths and
    `Related Symbols` only for searchable non-intake context.
11. Treat repeated findings in the same family as Planner or project-health
   review input before another local fix loop.
12. Before handoff, rerun the scan for the touched scopes and report literal
    marker/register sync status.
13. Record project-health findings in the marker and register, not only in the
    PR or reviewer output.

## Owner-Area Review

Owner areas are agent expertise packets. When a finding is systemic, select the
owner skill that can judge the target state rather than only a generic quality
or architecture lens. If no owner skill has the required expertise, record a
skill gap or project-health debt instead of approving the change silently.

Each owner skill should keep a short Health Review Checklist naming common
drift, forbidden adapters, and single-source-of-truth rules for that owner.
For owner areas with stateful code, the checklist should include common
structural-state drift such as stringly protocols, `null` domain state,
snapshot reconstruction, duplicated type literals, and view-local draft truth.

## Handoff

Report project-health disposition for covered work:

- `Project-health scan`: command and literal result.
- `Debt intake`: command, active matches, and disposition.
- `Debt markers`: synchronized, none found, added IDs, removed IDs, or blocker.
- `Repeated families`: none found, planner escalated, or WIP/blocker.
- `Baseline admission`: fresh proof, fresh review, and no supported findings
  hidden only in pass logs; objective-relevant structural debt fixed,
  user-excluded, or WIP/blocked; user-reported defect proof includes negative
  assertions against the old failure; blocker-driven repairs have a Blocker
  Reflection classification, rejected shortcut, and target-architecture or
  project-health benefit; incidental materialized debt synchronized; triggered
  structural-state matrix rows resolved, or incidental rows `Materialized`,
  with no unresolved blockers.

## References

- [Project Health Standard](../../../../docs/project/architecture/project-health.md)
- [Project Health Debt Register](../../../../docs/project/architecture/project-health-debt.md)
- [Agent Instruction Standard](../../../../docs/project/architecture/agent-instructions.md)
- [Project Health Scan](../../reporting/project_health_scan.py)
