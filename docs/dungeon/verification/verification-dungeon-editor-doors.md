Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-06-07
Source of Truth: Door route expectations for Dungeon Editor behavior
verification.

# Dungeon Editor Door Matrix

## Purpose

This catalog owns route-level proof rows for authored door creation, movement,
deletion, and protected deletion. Door selection is owned by
[Dungeon Editor Selection Matrix](verification-dungeon-editor-selection.md).
Wall and corridor catalogs own the neighboring wall-run and corridor-branch
effects.

## Proof Suite

Door rows are covered by `dungeonEditorDoorBehaviorHarness`, which selects the
`doors` suite plus declared core and selection dependencies. That focused route
must not run label or cluster-only proof rows.

## Verification Matrix

| ID | Interaction | Route | Fixture | Expected proof | Status |
| --- | --- | --- | --- | --- | --- |
| `DE-DOOR-001` | Create door on wall | Door family plus primary wall click | `F1_SINGLE_ROOM` | One eligible wall boundary becomes a door with stable topology; duplicate door creation is rejected or no-op. | Ready |
| `DE-DOOR-002` | Delete or reject door delete | Door family plus secondary click on a door | `F4_WALLED_ROOM_WITH_DOOR` variants | Unbound door delete removes the binding/topology and restores the boundary segment as wall; corridor-bound delete rejects and leaves authored state unchanged. | Ready |
| `DE-DOOR-003` | Focused protected-door rejection row | Door family plus secondary click on corridor-bound door | `F4_WALLED_ROOM_WITH_DOOR` variant | Door, corridor, room boundary, topology, preview, selection, published map, and render remain unchanged under a dedicated protected-delete proof. | Ready |
| `DE-DOOR-004` | Move door by shared handle | Selection tool plus primary drag on a door handle | `F16_HANDLE_VARIETY` | The door handle is visible and hittable, preview leaves SQLite unchanged, release moves the corridor binding and authored door boundary, and reload preserves the moved door. | Ready |

## References

- [Dungeon Editor Requirements](../requirements/requirements-dungeon-editor.md)
- [Dungeon Editor-Wide Invariants](verification-dungeon-editor-wide-invariants.md)
- [Dungeon Editor Selection Matrix](verification-dungeon-editor-selection.md)
- [Dungeon Door Invariants](verification-dungeon-door-invariants.md)
- [Dungeon Editor Wall Matrix](verification-dungeon-editor-walls.md)
- [Dungeon Editor Corridor Matrix](verification-dungeon-editor-corridors.md)
