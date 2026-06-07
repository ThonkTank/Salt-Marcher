Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-06-07
Source of Truth: Selection route expectations for Dungeon Editor behavior
verification.

# Dungeon Editor Selection Matrix

## Purpose

This catalog owns route-level proof rows for selecting stable authored targets
and clearing selection. Tool catalogs own the mutation behavior that may follow
after a target is selected.

## Verification Matrix

| ID | Interaction | Route | Fixture | Expected proof | Status |
| --- | --- | --- | --- | --- | --- |
| `DE-SEL-001` | Select room | `DungeonMapView` primary click on room floor | `F1_SINGLE_ROOM` | Selection resolves the stable room target and leaves authored rows unchanged. | Ready |
| `DE-SEL-002` | Select door | `DungeonMapView` primary click on door boundary | `F4_WALLED_ROOM_WITH_DOOR` | Selection resolves the stable door topology ref and owning room/cluster without authored row changes. | Ready |
| `DE-SEL-003` | Select stair | `DungeonMapView` primary click on stair handle | `F7_STAIR_ANCHOR` | Selection resolves the stable stair target and leaves authored rows unchanged. | Ready |
| `DE-SEL-004` | Select corridor anchor | `DungeonMapView` primary click on corridor anchor | `F5_CORRIDOR_WITH_ANCHOR` | Selection resolves the stable corridor-anchor target and leaves authored rows unchanged. | Ready |
| `DE-SEL-005` | Clear selection | `DungeonMapView` primary click on empty map space | `F1_SINGLE_ROOM` | Selection clears and authored rows remain unchanged. | Ready |

## References

- [Dungeon Editor Requirements](../requirements/requirements-dungeon-editor.md)
- [Dungeon Editor-Wide Invariants](verification-dungeon-editor-wide-invariants.md)
- [Dungeon Editor Room Matrix](verification-dungeon-editor-rooms.md)
- [Dungeon Editor Door Matrix](verification-dungeon-editor-doors.md)
- [Dungeon Editor Corridor Matrix](verification-dungeon-editor-corridors.md)
- [Dungeon Editor Stair Matrix](verification-dungeon-editor-stairs.md)
- [Dungeon Editor Handle Matrix](verification-dungeon-editor-handles.md)
