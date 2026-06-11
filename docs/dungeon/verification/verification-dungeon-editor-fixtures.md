Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-06-08
Source of Truth: Fixture definitions for Dungeon Editor behavior verification.

# Dungeon Editor Fixture Catalog

This document owns the named authored fixtures referenced by the Dungeon Editor
behavior verification matrix. The shared proof model and route ownership remain
in [Dungeon Editor-Wide Invariants](verification-dungeon-editor-wide-invariants.md).

## Fixture Catalog

| Fixture | Purpose | Required authored shape |
| --- | --- | --- |
| `F0_EMPTY_MAP` | Empty baseline | One map, no rooms, no clusters, no corridors, no stairs, no transitions, active level `0`. |
| `F1_SINGLE_ROOM` | Room, wall, door, narration, and selection baseline | Seeded room `R1` in cluster `C1` at level `0`; room anchor and cluster center `(2,2,0)` intentionally describe the fixture, not necessarily the current first-cell anchor chosen by freshly painted rooms; authored cells `(1..3, 1..3, 0)`; stored `dungeon_room_cluster_vertices.relative_x/relative_y` rows read back through the fixture center to absolute perimeter vertices `(1,1,0)`, `(4,1,0)`, `(4,4,0)`, `(1,4,0)`; seeded boundary edge rows read back as north/east/south/west walls; no doors. |
| `F2_ADJACENT_ROOMS` | Adjacent-not-overlap room behavior | `R1` cells `(1..3,1..3,0)` and `R2` cells `(4..6,1..3,0)`; shared border is adjacent only, no overlapping cell. |
| `F3_OVERLAPPING_ROOM_TARGET` | Merge behavior | Existing `R1` cells `(1..3,1..3,0)`; next paint rectangle is `(3..5,2..4,0)`, overlapping at `(3,2,0)` and `(3,3,0)`. |
| `F4_WALLED_ROOM_WITH_DOOR` | Door, corridor endpoint, and deletion behavior | `F1_SINGLE_ROOM` plus door `D1` on east boundary cell edge from `(3,2,0)` to `(4,2,0)`. |
| `F5_CORRIDOR_WITH_ANCHOR` | Corridor route, anchor, waypoint, and deletion behavior | Two rooms: `R1` cells `(1..3,1..3,0)` with door `D1` on east edge, `R2` cells `(8..10,1..3,0)` with door `D2` on west edge; corridor `K1` rectilinear path `(4,2,0) -> (6,2,0) -> (6,5,0) -> (7,5,0) -> (7,2,0)` ending at the corridor-side cell of `D2`; corridor anchor `A1` at `(6,5,0)` with an anchor-ref row pointing at `A1` so authored save/readback treats it as a referenced corridor connection point. The `DE-COR-004` proof variant adds `R3` cells `(5..7,9..11,0)` with north door `D3` so the deterministic route from `D1` to `D3` crosses `K1` at `A1`. |
| `F6_MULTI_LEVEL_FLOORS` | Level, onion slicing, floor crossing, and stairs | `R1` cells `(1..3,1..3,0)`, `R2` cells `(1..3,1..3,1)`, and `R3` cells `(1..3,1..3,2)` with projection controls enabled. |
| `F7_STAIR_ANCHOR` | Stair geometry editing | Supporting room `R1` on level `0` away from the stair path so valid recompute proofs are not preloaded with invalid geometry; stair `S1` has shape `STRAIGHT`, direction `NORTH`, `dimension1=3`, `dimension2=1`, anchor/path start `(2,2,0)`, path nodes `(2,2,0)`, `(2,1,0)`, `(2,0,0)`, and exits at `(2,2,0)` and `(2,0,1)`. |
| `F8_TWO_DOOR_ROUTE_TARGET` | Door-to-door corridor creation | `R1` cells `(1..3,1..3,0)` with door `D1` on boundary `cell=(3,2,0)`, `edge_direction=EAST`, topology kind `DOOR`; `R2` cells `(8..10,1..3,0)` with door `D2` on boundary `cell=(8,2,0)`, `edge_direction=WEST`, topology kind `DOOR`; no existing corridor between them. |
| `F9_MAP_CATALOG` | Map management | Existing maps `Zeta`, `Alpha`, and `Beta`; `Alpha` selected; all map rows have distinct stable map ids and no pending map editor dialog. `Zeta` is inserted before `Alpha` so the fixture can distinguish lowest inserted id from first catalog entry by name. `Alpha` contains one room `A1` at level `0` with cells `(1..3,1..3,0)` and no doors or corridors. `Beta` contains one room `B1` at level `0` with cells `(10..11,10..11,0)` and no doors or corridors. |
| `F10_TWO_ANCHOR_ROUTE_TARGET` | Anchor-to-anchor corridor creation | Corridor `K1` has anchor `A1` at `(2,6,0)` and corridor `K2` has anchor `A2` at `(8,6,0)`; each host corridor has a valid off-route waypoint host cluster so save/readback exercises the real persistence contract; no corridor currently connects `A1` and `A2`; no room interior lies on the horizontal route between them. |
| `F11_BLOCKED_CORRIDOR_ROUTE` | Invalid corridor route rejection | Blocking room `R1` cells `(1..3,1..3,0)`, west endpoint room `R2` cells `(-3..-1,1..3,0)`, and east endpoint room `R3` cells `(5..7,1..3,0)`; no doors or corridors exist before the attempt, so a rejected wall-to-wall corridor attempt proves route validation runs before door endpoint materialization. |
| `F12_ROOM_TO_DOOR_ROUTE_TARGET` | Generic room endpoint door materialization | `R1` cells `(1..3,1..3,0)` with no pre-existing door on its east boundary; `R2` cells `(8..10,1..3,0)` with door `D2` on boundary `cell=(8,2,0)`, `edge_direction=WEST`, topology kind `DOOR`; no existing corridor between them. |
| `F13_TRANSITION_DESCRIPTION` | Transition description editing and linking | `F6_MULTI_LEVEL_FLOORS` plus source transition `T1` at `(5,2,0)` with initial description `Initial transition.` and an overworld-tile destination, and target map `M2` containing transition `T2` at `(6,2,0)` with no existing link. |
| `F14_LARGE_STORED_VERTEX_MAP` | Startup/input responsiveness for previously persisted or pathological room loops | One persisted map containing one room whose cluster stores at least 56,000 per-cell loop vertex rows in `dungeon_room_cluster_vertices`; the fixture intentionally represents persisted DB state that is legal to keep in the catalog but must not be loaded synchronously just because the app shell starts. |
| `F15_COMPLEX_CLUSTER` | True-corner, wall-run, and label placement behavior | One non-rectangular cluster `C1` at level `0` containing at least two rooms and an authored concave perimeter; the perimeter has at least six real wall corners, one interior wall run, one exterior wall run, and straight runs long enough to publish midpoint wall-run handles. Room labels are present as floor-cell-derived text with view-owned longest-wall orientation. |
| `F16_HANDLE_VARIETY` | Shared handle identity, hit route, preview, and visual style | One map combining `F15_COMPLEX_CLUSTER`, corridor `K1` with anchor `A1`, stair `S1`, and door `D1`, so the common handle model can cover cluster-corner publication/rendering alongside corridor, stair, and door handle publication. Door publication shares the common handle identity shape; rendered door hit proof remains boundary-owned, and door drag-preview proof is boundary-owned rather than part of the shared-handle proof route. True-corner drag readiness is owned and proved by the Ready `DE-CLUSTER-003` row; wall-run drag has preview, commit, reload, and invalid-rejection coverage in the Ready `DE-CLUSTER-002` row. `CLUSTER_WALL_RUN` is a hittable smaller midpoint handle. |
| `F17_VERTICAL_FALLBACK_CORRIDOR_ROUTE` | Corridor route fallback | Door `D1` on `R1` east edge with corridor-side cell `(4,2,0)`, door `D2` on `R2` west edge with corridor-side cell `(9,7,0)`, and blocking room `R_BLOCK` cells `(5..7,1..3,0)`. Horizontal-first crosses `R_BLOCK`, while vertical-first remains open through `(4,2,0) -> (4,7,0) -> (9,7,0)`. |

## References

- [Dungeon Editor-Wide Invariants](verification-dungeon-editor-wide-invariants.md)
- [Dungeon Editor Requirements](../requirements/requirements-dungeon-editor.md)
- [Dungeon Persistence Contract](../contract/contract-dungeon-persistence.md)
- [Dungeon Domain Architecture](../architecture/architecture-dungeon-domain.md)
- [Dungeon Domain](../domain/domain-dungeon.md)
