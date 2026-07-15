Status: Active
Source of Truth: The project-health debt marker and register flow -- how known
structural, governance, compatibility, and legacy-removal debt is materialized,
found again, and closed.

# Project Health

Known structural problems must be discoverable where they hurt the code and
searchable from one register. A problem recorded only in a pass log or a chat
is not recorded.

This flow is mechanically enforced: the staged verification wrappers run
`project_health_scan.py --intake --intake-only` before `production-handoff`
(for changed worktree paths) and `focused-handoff` (for focused paths and
areas). A matching open debt entry fails the wrapper before Gradle starts.

## When to Materialize Debt

Structural, architecture, governance, compatibility, or legacy-removal findings
you cannot fix in the same pass get a marker plus a register entry. Typical
families:

- unowned compatibility seams, duplicated system-of-record facts, competing
  mutation paths, unclear state ownership;
- stringly typed boundary protocols, encoded UI values, `null` as a domain
  state, view draft state acting as truth;
- gate-shaped workarounds: a repair that satisfies a check or review phrase
  while making the target structure less clear (for example, replacing typed
  state with a raw protocol only to pass a layer rule). A green gate after such
  a workaround is not a health improvement.
- self-confirming harnesses: proof that would still pass if the reported
  failure remained. For an owner-reported defect, the harness needs a negative
  assertion tied to the old failure.

Debt inside the current objective is not incidental baseline: fix it, get
explicit user exclusion, or report it as WIP/blocker. Materialization preserves
*incidental* debt outside the objective; it must not turn unfinished objective
work into a clean handoff.

## Marker

Place at the primary cause, close enough that an agent editing the area sees it
without opening a central log. When several files are affected, mark the
primary cause and list satellites in the register.

```text
PROJECT_HEALTH_DEBT[PH-YYYYMMDD-NNN]: <problem>; owner=<area>; remove_when=<concrete condition>.
```

The same marker family covers targeted legacy removal; do not create a second
one.

## Register

[Project Health Debt Register](project-health-debt.md). The scanner parses it:
each entry is an `## PH-YYYYMMDD-NNN` heading followed by `- <Field>: <value>`
lines. Field names and status values below are machine-read -- keep them exact.

Every marker ID has exactly one register entry. Every entry has a marker unless
it documents a pure process or tooling problem with no honest code location;
those state `Marker: none` and explain why.

The register's own entry template names the required fields; copy it rather
than reproducing the list here. List fields are comma-separated. Path tokens
match case-sensitively, owner-area tokens case-insensitively.

Intake matches on `Marker`, `Owner Areas`, `Affected Paths`, and
`Intake Trigger` only -- `Related Symbols` is descriptive and deliberately not
an intake trigger. The default `Resolution Mode` is `Next Matching Touch`;
entries without explicit resolver fields are treated as
`Resolution Mode: Next Matching Touch` and `Resolver Status: Open`.

### Resolver Dispositions

| Outcome | Marker | Register Section | Status | Resolution Mode | Resolver Status |
| --- | --- | --- | --- | --- | --- |
| Fixed or removed | remove marker | Removed Or Closed Debt | Removed | Next Matching Touch | Resolved |
| False positive | remove marker, or keep `Marker: none` for markerless entries | Removed Or Closed Debt | False Positive | Next Matching Touch | False Positive |
| Superseded | replace marker with the new debt ID when one exists | Removed Or Closed Debt | Superseded | Next Matching Touch | Superseded |
| Explicit user exclusion | keep marker unless the user excludes a markerless entry | Active Debt | Open | User Excluded | User Excluded |
| Blocked or WIP | keep marker | Active Debt | Open | Next Matching Touch | Blocked |

Only entries whose `Status` or `Resolver Status` is closed, or whose
`Resolution Mode` is `User Excluded`, are inactive for intake. `Blocked` stays
active and must be reported as WIP when matched.

## Repetition

`tools/quality/reporting/project_health_scan.py` is the read-only helper for
marker/register sync, intake, and repeated pass-log terms (it owns its own term
list; there is no second list to maintain here).

The second occurrence of the same debt family in a touched owner area triggers
review before another local fix loop. A family can be a symbol name, a marker
ID, an owner area, or a repeated finding shape.

When expertise is missing, record a skill gap or project-health debt. Missing
expertise is not approval.

## Owner Areas

An owner area is an agent expertise packet, not a human team: the smallest
stable surface whose docs, skills, and failure patterns let an agent judge
whether a change improves or damages the target architecture. See the Surface
Owners table in `AGENTS.md`.

Use existing areas before adding new ones. Split an area only when it owns two
concerns that now need different target rules, proof routes, or reviewer
expertise. Merge or reroute an area when its rules have become a thin duplicate
of another owner.

## References

- [Project Health Debt Register](project-health-debt.md)
- [Agent Instruction Standard](agent-instructions.md)
