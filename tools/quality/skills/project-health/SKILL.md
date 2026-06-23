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
   `LEGACY_REMOVE_ON_TOUCH`, `temporary compatibility`,
   `retained compatibility`, `stale`, `deferred`, `review-owned`, and
   `outside write set`.
4. Run `python3 tools/quality/reporting/project_health_scan.py` with the
   narrowest relevant `--scope` paths, or state why the pass has no
   project-health surface.
5. Classify supported findings as fixed, false positive with evidence,
   user-excluded, WIP/blocker, or materialized project-health debt.
6. For materialized debt, add a local marker at the primary cause:
   `PROJECT_HEALTH_DEBT[PH-YYYYMMDD-NNN]: <problem>; owner=<area>; remove_when=<condition>.`
7. Add exactly one register entry in
   `docs/project/architecture/project-health-debt.md`.
8. For pure process or tooling debt with no honest local marker, add a register
   entry with `Marker: none` and the reason.
9. Treat repeated findings in the same family as Planner or project-health
   review input before another local fix loop.
10. Before handoff, rerun the scan for the touched scopes and report literal
    marker/register sync status.
11. Record project-health findings in Implementation Reading Packets and pass
    logs through `docs/project/architecture/implementation-documentation.md`
    without duplicating that standard's packet or log field lists here.

## Owner-Area Review

Owner areas are agent expertise packets. When a finding is systemic, select the
owner skill that can judge the target state rather than only a generic quality
or architecture lens. If no owner skill has the required expertise, record a
skill gap or project-health debt instead of approving the change silently.

Each owner skill should keep a short Health Review Checklist naming common
drift, forbidden adapters, and single-source-of-truth rules for that owner.

## Handoff

Report project-health disposition for covered work:

- `Project-health scan`: command and literal result.
- `Debt markers`: synchronized, none found, added IDs, removed IDs, or blocker.
- `Repeated families`: none found, planner escalated, or WIP/blocker.
- `Baseline admission`: fresh proof, fresh review, and no supported findings
  hidden only in pass logs.

## References

- [Project Health Standard](../../../../docs/project/architecture/project-health.md)
- [Project Health Debt Register](../../../../docs/project/architecture/project-health-debt.md)
- [Agent Instruction Standard](../../../../docs/project/architecture/agent-instructions.md)
- [Implementation Documentation Standard](../../../../docs/project/architecture/implementation-documentation.md)
- [Project Health Scan](../../reporting/project_health_scan.py)
