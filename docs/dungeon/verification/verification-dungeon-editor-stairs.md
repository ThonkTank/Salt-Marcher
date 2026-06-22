Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-06-07
Source of Truth: Stair route expectations for Dungeon Editor behavior
verification.

# Dungeon Editor Stair Matrix

## Purpose

This catalog owns route expectations for stair creation, editing, deletion,
validation, and cross-level corridor-bound stair behavior. Shared proof model,
status vocabulary, route ownership, and completion criteria remain in
[Dungeon Editor-Wide Invariants](verification-dungeon-editor-wide-invariants.md).

## Verification Matrix

| ID | Interaction | Route | Fixture | Expected proof | Status |
| --- | --- | --- | --- | --- | --- |
| `DE-STATE-003` | Stair dimensions and shape | State panel stair card | `F7_STAIR_ANCHOR` | Valid shape, direction, and dimension edits recompute path/exits while preserving stair identity. | Ready |
| `DE-STAIR-001` | Create straight stair | Stair dropdown selects `Gerade`, first primary click starts a draft, projection level changes, second primary click commits | `F1_SINGLE_ROOM` plus reachable upper level | First click and pointer movement create no DB rows; preview survives level switch, renders the full generated stair with z labels, and second click commits the exact derived straight spec. | Ready |
| `DE-STAIR-002` | Create square spiral stair | Stair dropdown selects `Eckspirale`, first primary click starts a draft, invalid endpoint previews, valid endpoint second-click commits | `F1_SINGLE_ROOM` plus reachable upper level | Invalid exact-match endpoint publishes a concrete mismatch status and creates no DB rows; valid preview survives level switch and second click commits square stair geometry. | Ready |
| `DE-STAIR-003` | Create round spiral stair | Stair dropdown selects `Rundspirale`, first primary click starts a draft, projection level changes, second primary click commits | `F1_SINGLE_ROOM` plus reachable upper level | First click creates no DB rows; cross-level preview derives exact circular endpoints with visible z labels, second click commits, preview clears, and reload preserves geometry. | Ready |
| `DE-STAIR-004` | Edit stair dimensions | State panel stair editor | `F7_STAIR_ANCHOR` | Valid edits recompute atomically; invalid zero-span or out-of-range values reject without mutation. | Ready |
| `DE-STAIR-005` | Move stair path anchor by view handle | Select tool plus stair-anchor handle drag | `F7_STAIR_ANCHOR` | Direct handle movement moves the selected path node while preserving exits and stair identity. | Ready |
| `DE-STAIR-006` | Floor crossing creates exits | Stair state-panel edit route | `F7_STAIR_ANCHOR` | Recompute across multiple levels persists ordered exits for each crossed level. | Ready |
| `DE-STAIR-007` | Invalid stair geometry rejected | Stair creation/edit route | `F7_STAIR_ANCHOR` | Invalid creation or edit leaves previous stair, path, exits, selection, preview, and DB rows unchanged. | Ready |
| `DE-STAIR-008` | Cross-level corridor creates stair segment | Corridor tool between doors on different levels | `F6_MULTI_LEVEL_FLOORS` | Cross-level corridor commit creates or reuses a corridor-bound stair segment. | Ready |
| `DE-STAIR-009` | Delete stair | Stair family plus secondary delete gesture | `F7_STAIR_ANCHOR` | Unbound stair deletes; corridor-bound stair rejects unless the owning corridor branch is deleted. | Ready |
| `DE-STAIR-010` | Anchor-preserving full stair recompute | State panel stair editor | `F7_STAIR_ANCHOR` | Stair id and topology ref survive full recompute from the preserved lower anchor. | Ready |

## References

- [Dungeon Editor-Wide Invariants](verification-dungeon-editor-wide-invariants.md)
- [Dungeon Editor Fixture Catalog](verification-dungeon-editor-fixtures.md)
- [Dungeon Editor Requirements](../requirements/requirements-dungeon-editor.md)
- [Dungeon Stair Invariants](verification-dungeon-stair-invariants.md)
- [Dungeon Path Invariants](verification-dungeon-path-invariants.md)
- [Dungeon Corridor Invariants](verification-dungeon-corridor-invariants.md)
