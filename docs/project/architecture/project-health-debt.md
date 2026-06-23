Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-06-22
Source of Truth: Central register for known project-health debt IDs,
marker synchronization, removal conditions, and current disposition.

# Project Health Debt Register

## Purpose

This register is the searchable canonical list for known structural,
architecture, governance, and quality debt that survived a pass. The local
marker remains the primary in-file warning; this register provides cross-file
searchability and disposition.

Do not record ordinary task notes here. Add an entry only when a supported
finding cannot be fixed in the same pass and would otherwise be hidden in pass
logs or reviewer output.

## Entry Format

Use one section per ID:

```text
## PH-YYYYMMDD-NNN - Short Title

- Status: Open | In Progress | Removed | False Positive | Superseded
- Marker: <path>:<line> | none - <process/tooling reason>
- Problem: <known issue>
- Owner Areas: <area list>
- Affected Paths Or Symbols: <paths, packages, symbols, or satellites>
- Source Evidence: <pass log, review output, command, or discovery note>
- Decision: <why it remains and why this is not target architecture>
- Remove When: <concrete condition>
- Last Checked: YYYY-MM-DD
```

Every code or documentation marker must have exactly one section here. Every
section must have a matching marker unless `Marker: none` names a pure process
or tooling problem with no honest local marker location.

## Active Debt

No active project-health debt has been registered yet under this governance.

## Removed Or Closed Debt

No project-health debt has been removed or closed yet under this governance.

## References

- [Project Health Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/project-health.md:1)
- [Project Health Skill](/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/project-health/SKILL.md:1)
