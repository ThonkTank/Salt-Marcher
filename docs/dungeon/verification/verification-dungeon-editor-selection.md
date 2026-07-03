Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-06-23
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
| `DE-SEL-006` | Hover selectable map target | `OwnerSuite=DungeonEditorSelectionHarness`; `ProofType=RealRoute`; `DungeonMapView` mouse move over selectable targets, plain wall edges, room labels, and empty/off-grid space | `F1_SINGLE_ROOM` / `F4_WALLED_ROOM_WITH_DOOR` / `F7_STAIR_ANCHOR` | Hover styling is content-model presentation state, remains visually distinct from selected and preview styling, appears only for existing selectable targets, and clears or stays absent for non-selectable wall, room-label, and tool-only geometry without authored row changes. | Ready |
| `DE-SEL-014` | Clear selection on tool switch | `OwnerSuite=DungeonEditorSelectionHarness`; `ProofType=RealRoute`; select a stable transition, then switch from `Auswahl` to a non-selection tool | `F13_TRANSITION_DESCRIPTION` | State selection, map-surface selection, inspector, selected render highlight, and selected-transition state-panel cards clear immediately; switching back to `Auswahl` does not invent a selection. | Ready |
| `DE-HOVER-001` | Hover active editor tool geometry | `OwnerSuite=DungeonEditorSelectionHarness`; `ProofType=RealRoute`; active tool plus `DungeonMapView` mouse move | mixed editor fixtures | Wall-path hover highlights vertices, wall single-click hover highlights edges, room hover highlights cells, and corridor hover highlights only wall or door boundary edges plus authored corridor cells. | Ready |

## References

- [Dungeon Editor Requirements](../requirements/requirements-dungeon-editor.md)
- [Dungeon Editor-Wide Invariants](verification-dungeon-editor-wide-invariants.md)
- [Dungeon Editor Room Matrix](verification-dungeon-editor-rooms.md)
- [Dungeon Editor Door Matrix](verification-dungeon-editor-doors.md)
- [Dungeon Editor Corridor Matrix](verification-dungeon-editor-corridors.md)
- [Dungeon Editor Stair Matrix](verification-dungeon-editor-stairs.md)
- [Dungeon Editor Handle Matrix](verification-dungeon-editor-handles.md)
