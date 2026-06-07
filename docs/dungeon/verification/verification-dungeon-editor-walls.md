Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-06-07
Source of Truth: Wall route expectations for Dungeon Editor behavior
verification.

# Dungeon Editor Wall Matrix

## Purpose

This catalog owns route-level proof rows for wall creation, wall preview,
context-sensitive secondary input, optional single-click mode, and wall-run
deletion. The requirements document owns the target behavior; this file maps it
to proof rows.

## Verification Matrix

| ID | Interaction | Route | Fixture | Expected proof | Status |
| --- | --- | --- | --- | --- | --- |
| `DE-WALL-001` | Start wall path preview | Wall family button then primary vertex click | `F1_SINGLE_ROOM` | Start point is retained as draft state; no wall rows persist before a candidate segment exists. | Ready |
| `DE-WALL-002` | Historical release-based wall route | Wall family plus release gesture | `F1_SINGLE_ROOM` | Legacy release coverage may persist wall rows, but it does not close the target path-based create process. | Re-scoped |
| `DE-WALL-003` | Move preview endpoint | Pointer movement while wall draft is active | `F1_SINGLE_ROOM` | Preview endpoint follows the pointer; committed map and SQLite remain unchanged. | Ready |
| `DE-WALL-004` | Historical secondary boundary-path delete | Wall family plus secondary boundary path | `F1_SINGLE_ROOM` | Legacy delete coverage does not close target straight-run, corner-run, or exterior-protection behavior. | Re-scoped |
| `DE-WALL-005` | Historical secondary wall-segment delete | Wall family plus secondary wall segment hit | `F1_SINGLE_ROOM` | Legacy segment deletion does not close target whole straight-run deletion. | Re-scoped |
| `DE-WALL-006` | Historical secondary wall-corner delete | Wall family plus secondary wall corner hit | `F1_SINGLE_ROOM` | Legacy corner deletion does not close target deletion of every connected straight run to its next corner. | Re-scoped |
| `DE-WALL-007` | Historical shift-secondary wall creation | Wall family plus Shift-secondary release | `F1_SINGLE_ROOM` | Legacy alternate-create coverage does not close target path-mode or optional single-click-mode behavior. | Re-scoped |
| `DE-WALL-008` | Add intermediate wall point | Active wall path plus primary vertex click | `F1_SINGLE_ROOM` | Click adds committed preview edges to the draft path without finalizing or persisting authored rows. | Implementation Gap |
| `DE-WALL-009` | Complete wall path by secondary input | Active wall path plus secondary click | `F1_SINGLE_ROOM` | Entire drafted path persists atomically; preview clears; duplicate topology rows are not created. | Implementation Gap |
| `DE-WALL-010` | Complete wall path by hitting existing wall | Active wall path plus primary click on existing wall | `F1_SINGLE_ROOM` | Entire drafted path persists atomically and connects to the existing wall. | Implementation Gap |
| `DE-WALL-011` | Toggle single-click wall mode | Ctrl toggle or wall-button dropdown | `F0_EMPTY_MAP` | Mode changes between path and single-click behavior and is visible in tool/session state. | Implementation Gap |
| `DE-WALL-012` | Delete straight wall run | Wall tool with no active create draft, secondary delete path on wall run | `F1_SINGLE_ROOM` | The whole contiguous straight run to the next corner is marked open or removed; unrelated wall runs stay. | Implementation Gap |
| `DE-WALL-013` | Delete corner-connected runs | Secondary delete on a wall corner | `F1_SINGLE_ROOM` | Every contiguous straight run meeting at the corner is deleted until its next corner. | Implementation Gap |
| `DE-WALL-014` | Reject cluster exterior wall delete | Secondary delete on exterior cluster wall | `F1_SINGLE_ROOM` | Rejection status is published; authored rows, topology, preview, and selection remain unchanged. | Implementation Gap |

## References

- [Dungeon Editor Requirements](../requirements/requirements-dungeon-editor.md)
- [Dungeon Editor-Wide Invariants](verification-dungeon-editor-wide-invariants.md)
- [Dungeon Wall Invariants](verification-dungeon-wall-invariants.md)
- [Dungeon Path Invariants](verification-dungeon-path-invariants.md)
