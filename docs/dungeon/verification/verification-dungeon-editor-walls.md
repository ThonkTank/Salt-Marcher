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

Row IDs are stable; removed IDs stay retired and are not reused or renumbered.

| ID | Interaction | Route | Fixture | Expected proof | Status |
| --- | --- | --- | --- | --- | --- |
| `DE-WALL-001` | Start wall path preview | Wall family button then primary vertex click | `F1_SINGLE_ROOM` | Start point is retained as draft state; no wall rows persist before a candidate segment exists. | Ready |
| `DE-WALL-003` | Move preview endpoint | Pointer movement while wall draft is active | `F1_SINGLE_ROOM` | Preview endpoint follows the pointer; committed map and SQLite remain unchanged. | Ready |
| `DE-WALL-008` | Add intermediate wall point | Active wall path plus primary vertex click | `F1_SINGLE_ROOM` | Click adds committed preview edges to the draft path without finalizing or persisting authored rows. | Ready |
| `DE-WALL-009` | Complete wall path by secondary input | Active wall path plus secondary click | `F1_SINGLE_ROOM` | Entire drafted path persists atomically; preview clears; duplicate topology rows are not created. | Ready |
| `DE-WALL-010` | Complete wall path by hitting existing wall | Active wall path plus primary click on existing wall | `F1_SINGLE_ROOM` | Entire drafted path persists atomically and connects to the existing wall. | Ready |
| `DE-WALL-011` | Use single-click wall mode | Ctrl-modified gesture | `F0_EMPTY_MAP` | A transient Ctrl modifier changes one primary release from path behavior to single-click wall completion while path mode remains the default. | Ready |
| `DE-WALL-012` | Delete straight wall run | Wall tool with no active create draft, secondary delete path on wall run | `F1_SINGLE_ROOM` | The whole contiguous straight run to the next corner is marked open or removed; unrelated wall runs stay. | Ready |
| `DE-WALL-013` | Delete corner-connected runs | Secondary delete on a wall corner | `F1_SINGLE_ROOM` | Every contiguous straight run meeting at the corner is deleted until its next corner. | Ready |
| `DE-WALL-014` | Reject cluster exterior wall delete | Secondary delete on exterior cluster wall | `F1_SINGLE_ROOM` | Rejection status is published; authored rows, topology, preview, and selection remain unchanged. | Ready |

## References

- [Dungeon Editor Requirements](../requirements/requirements-dungeon-editor.md)
- [Dungeon Editor-Wide Invariants](verification-dungeon-editor-wide-invariants.md)
- [Dungeon Wall Invariants](verification-dungeon-wall-invariants.md)
- [Dungeon Path Invariants](verification-dungeon-path-invariants.md)
