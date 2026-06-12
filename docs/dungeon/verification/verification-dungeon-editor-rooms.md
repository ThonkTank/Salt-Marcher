Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-06-07
Source of Truth: Room route expectations for Dungeon Editor behavior
verification.

# Dungeon Editor Room Matrix

## Purpose

This catalog owns route-level proof rows for room paint, delete, preview, and
narration behavior. Label text, rename routes, placement, hit separation, and
reload stability are owned by
[Dungeon Editor Label Matrix](verification-dungeon-editor-labels.md). This
catalog maps the requirements-owned room behavior to observable persistence,
snapshot, and render proof without redefining room domain invariants.

Fresh room paint route proof owns the UI-to-persistence assertion that committed
and reloaded room creation writes cluster floor-cell rows and perimeter wall
rows. The floor and wall catalogs own the model-invariant proof for the
underlying floor and wall owners; those invariant rows do not by themselves
prove the editor route.

## Verification Matrix

| ID | Interaction | Route | Fixture | Expected proof | Status |
| --- | --- | --- | --- | --- | --- |
| `DE-PREVIEW-001` | Room preview does not persist before completion | Room family plus `DungeonMapView` drag without release | `F0_EMPTY_MAP` | Preview publishes only draft area; SQLite and committed map remain unchanged. | Ready |
| `DE-PREVIEW-002` | Cancel draft without commit | Room family preview plus `Esc` | `F0_EMPTY_MAP` | Preview clears, tool resets to `Auswahl`, and authored rows remain absent. | Ready |
| `DE-ROOM-001` | Paint isolated room | Room family plus primary drag/release | `F0_EMPTY_MAP` | One room and cluster persist; after commit and reload, stored cluster floor-cell rows match the painted rectangle and stored perimeter `WALL` rows form a closed boundary around that floor-cell set. Rendering may project from those persisted facts but does not substitute for them. | Ready |
| `DE-ROOM-002` | Paint overlapping room merges | Room family plus overlapping drag/release | `F3_OVERLAPPING_ROOM_TARGET` | Existing room/cluster identity survives; union cells persist; stale internal walls do not publish. | Ready |
| `DE-ROOM-003` | Paint adjacent room does not merge | Room family plus adjacent drag/release | `F1_SINGLE_ROOM` | A separate room and cluster persist when no authored cell overlaps. | Ready |
| `DE-ROOM-004` | Delete whole room rectangle | Room family plus secondary drag/release | `F1_SINGLE_ROOM` | Target room/cluster rows, topology, boundaries, handles, and preview are removed or cleared. | Ready |
| `DE-STATE-001` | Edit room narration | `DungeonEditorStateView` narration card | `F4_WALLED_ROOM_WITH_DOOR` | Room visual and exit narration persist, reload, and leave geometry unchanged. | Ready |

## References

- [Dungeon Editor Requirements](../requirements/requirements-dungeon-editor.md)
- [Dungeon Editor-Wide Invariants](verification-dungeon-editor-wide-invariants.md)
- [Dungeon Editor Label Matrix](verification-dungeon-editor-labels.md)
- [Dungeon Room Invariants](verification-dungeon-room-invariants.md)
- [Dungeon Floor Invariants](verification-dungeon-floor-invariants.md)
- [Dungeon Wall Invariants](verification-dungeon-wall-invariants.md)
- [Dungeon Cluster Invariants](verification-dungeon-cluster-invariants.md)
