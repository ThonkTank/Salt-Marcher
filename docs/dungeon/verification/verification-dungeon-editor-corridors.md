Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-06-08
Source of Truth: Corridor route, anchor, waypoint, deletion, and corridor
state route expectations for Dungeon Editor behavior verification.

# Dungeon Editor Corridor Matrix

## Purpose

This catalog owns route expectations for corridor creation, preview-only
drafting, anchor movement, route splitting, protected deletion, invalid-route
rejection, and corridor point editing. The shared proof model, status
vocabulary, gesture convention, route ownership, and completion criteria remain
in [Dungeon Editor-Wide Invariants](verification-dungeon-editor-wide-invariants.md).

## Verification Matrix

| ID | Interaction | Route | Fixture | Expected proof | Status |
| --- | --- | --- | --- | --- | --- |
| `DE-SEL-006` | Move selected corridor handle | Select tool plus corridor-anchor handle drag | `F5_CORRIDOR_WITH_ANCHOR` | Drag preview moves the handle visually without DB mutation; release persists the existing anchor identity at the new cell. | Ready |
| `DE-STATE-004` | Corridor point edit from state panel | `DungeonEditorStateView` corridor point card | `F5_CORRIDOR_WITH_ANCHOR` | Existing anchor/waypoint coordinates update without duplicate anchor, endpoint, or route churn. | Ready |
| `DE-COR-001` | Commit door-to-door corridor | Corridor family plus two door hits | `F8_TWO_DOOR_ROUTE_TARGET` | One valid corridor persists between the two explicit door endpoints and renders after commit. | Ready |
| `DE-COR-002` | Commit door-to-anchor corridor | Corridor family plus door and anchor hits | `F5_CORRIDOR_WITH_ANCHOR` | The existing anchor is reused at commit; no duplicate endpoint is created. | Ready |
| `DE-COR-003` | Commit anchor-to-anchor corridor | Corridor family plus two anchor hits | `F10_TWO_ANCHOR_ROUTE_TARGET` | The two existing anchors bind the new corridor and remain stable. | Ready |
| `DE-COR-004` | Split corridor at crossing | Full corridor commit whose route crosses an existing corridor | `F5_CORRIDOR_WITH_ANCHOR` variant | Crossing split reuses the authored crossing anchor through SQLite readback and render. | Ready |
| `DE-COR-005` | Persist moved corridor anchor | Release after corridor-anchor handle drag | `F5_CORRIDOR_WITH_ANCHOR` | Release persists the existing anchor identity at the new cell and renders readback. | Ready |
| `DE-COR-006` | Delete connection point and reroute | Corridor family plus secondary delete on point | `F5_CORRIDOR_WITH_ANCHOR` | Selected point is removed only when replacement route is valid; invalid replacement leaves all rows unchanged. | Ready |
| `DE-COR-007` | Delete door connection branch | Corridor family plus secondary delete on door binding | `F5_CORRIDOR_WITH_ANCHOR` | Only the branch span to the nearest surviving authored corridor point is removed. | Ready |
| `DE-COR-008` | Invalid route rejected | Corridor draft completed with blocked target | `F11_BLOCKED_CORRIDOR_ROUTE` | Status reports rejection and no draft endpoint materialization persists. | Ready |
| `DE-COR-009` | Generic room hit materializes endpoint | Corridor family plus generic room hit | `F12_ROOM_TO_DOOR_ROUTE_TARGET` | Generic room hit resolves to the facing door endpoint and persists the successful corridor route. | Ready |
| `DE-COR-010` | Generic corridor hit reuses anchor | Corridor family plus generic corridor hit at existing anchor cell | `F5_CORRIDOR_WITH_ANCHOR` | Existing anchor is reused for the successful corridor route. | Ready |
| `DE-COR-011` | Generic corridor hit creates anchor | Corridor family plus unanchored corridor cell | `F5_CORRIDOR_WITH_ANCHOR` | A new anchor is authored for the successful corridor route. | Ready |
| `DE-COR-012` | First corridor click remains preview-only | Corridor family plus first primary endpoint hit | `F8_TWO_DOOR_ROUTE_TARGET`, `F12_ROOM_TO_DOOR_ROUTE_TARGET`, `F5_CORRIDOR_WITH_ANCHOR` | The first click selects a pending endpoint and publishes preview/session state only; explicit door, generic room, and generic corridor starts persist no door, anchor, corridor, route, topology, authored geometry, committed surface, or render delta. | Ready |
| `DE-COR-013` | Generic endpoint materializes only at full commit | Pending corridor draft using generic room or corridor hit | `F12_ROOM_TO_DOOR_ROUTE_TARGET`, `F5_CORRIDOR_WITH_ANCHOR`, `F11_BLOCKED_CORRIDOR_ROUTE` | Facing door or anchor creation/reuse happens atomically with successful full corridor commit, never as a first-click side effect, and a blocked generic-room completion materializes no endpoint; success is proved through SQLite readback, topology identity, published snapshot, reload, and render. | Ready |

## References

- [Dungeon Editor-Wide Invariants](verification-dungeon-editor-wide-invariants.md)
- [Dungeon Editor Fixture Catalog](verification-dungeon-editor-fixtures.md)
- [Dungeon Editor Requirements](../requirements/requirements-dungeon-editor.md)
- [Dungeon Corridor Invariants](verification-dungeon-corridor-invariants.md)
- [Dungeon Path Invariants](verification-dungeon-path-invariants.md)
- [Dungeon Door Invariants](verification-dungeon-door-invariants.md)
