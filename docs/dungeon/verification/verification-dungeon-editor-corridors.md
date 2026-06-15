Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-06-11
Source of Truth: Corridor route, anchor, waypoint, deletion, and corridor
state route expectations for Dungeon Editor behavior verification.

# Dungeon Editor Corridor Matrix

## Purpose

This catalog owns route expectations for corridor creation, preview-only
drafting, passive anchor refs, route splitting, protected deletion,
invalid-route rejection, and focused corridor point editing. The shared proof model, status
vocabulary, gesture convention, route ownership, and completion criteria remain
in [Dungeon Editor-Wide Invariants](verification-dungeon-editor-wide-invariants.md).

## Verification Matrix

| ID | Interaction | Route | Fixture | Expected proof | Status |
| --- | --- | --- | --- | --- | --- |
| `DE-SEL-006` | Suppress generic corridor canvas handle drag | Select tool plus corridor-anchor coordinates | `F5_CORRIDOR_WITH_ANCHOR` | Published corridor anchor refs are not rendered or hit-tested as generic canvas drag handles; attempted anchor drag leaves preview, SQLite, and render state unchanged. | Ready |
| `DE-STATE-004` | Corridor point edit from state panel | `DungeonEditorStateView` corridor point card | `F5_CORRIDOR_WITH_ANCHOR` | Existing anchor/waypoint coordinates update without duplicate anchor, endpoint, or route churn. | Ready |
| `DE-COR-004` | Split corridor at crossing | Full corridor commit whose route crosses an existing corridor | `F5_CORRIDOR_WITH_ANCHOR` variant | Crossing split reuses the authored crossing anchor through SQLite readback and render. | Ready |
| `DE-COR-005` | Keep suppressed corridor anchor drag passive | Release after attempted corridor-anchor canvas drag | `F5_CORRIDOR_WITH_ANCHOR` | Release after a suppressed anchor drag keeps the existing anchor identity and coordinates unchanged; state-panel endpoint editing owns coordinate movement. | Ready |
| `DE-COR-006` | Delete connection point and reroute | Corridor family plus secondary delete on point | `F5_CORRIDOR_WITH_ANCHOR` | Selected point is removed only when replacement route is valid; invalid replacement leaves all rows unchanged. | Ready |
| `DE-COR-007` | Delete door connection branch | Corridor family plus secondary delete on door binding | `F5_CORRIDOR_WITH_ANCHOR` | Only the branch span to the nearest surviving authored corridor point is removed. | Ready |
| `DE-COR-008` | Invalid route rejected | Corridor draft completed with blocked target | `F11_BLOCKED_CORRIDOR_ROUTE` | Status reports rejection and no draft endpoint materialization persists. | Ready |
| `DE-COR-013` | Generic endpoint materializes only at full commit | Pending corridor draft using generic room or corridor hit | `F12_ROOM_TO_DOOR_ROUTE_TARGET`, `F5_CORRIDOR_WITH_ANCHOR` | Generic room hits materialize the facing door only at successful commit; generic corridor hits reuse an existing anchor or create exactly one missing anchor only at successful commit. Hover proves a visible corridor preview map and rendered preview route without publishing a typed preview or materializing endpoints early; success is proved through SQLite readback, topology identity, published snapshot, reload, and render. | Ready |
| `DE-COR-014` | Horizontal-blocked corridor uses fallback route | Corridor family plus two door hits where horizontal-first crosses a blocking room and vertical-first is open | `F17_VERTICAL_FALLBACK_CORRIDOR_ROUTE` | The first explicit door click persists no partial corridor; hover proves the vertical-first fallback route is visible while committed door targets remain authoritative; the full click route reuses existing explicit door endpoint identities, persists one corridor using the fallback cells, reloads the same rendered route, and leaves the visible fallback corridor body as a semantic corridor target. | Ready |

## References

- [Dungeon Editor-Wide Invariants](verification-dungeon-editor-wide-invariants.md)
- [Dungeon Editor Fixture Catalog](verification-dungeon-editor-fixtures.md)
- [Dungeon Editor Requirements](../requirements/requirements-dungeon-editor.md)
- [Dungeon Corridor Invariants](verification-dungeon-corridor-invariants.md)
- [Dungeon Path Invariants](verification-dungeon-path-invariants.md)
- [Dungeon Door Invariants](verification-dungeon-door-invariants.md)
