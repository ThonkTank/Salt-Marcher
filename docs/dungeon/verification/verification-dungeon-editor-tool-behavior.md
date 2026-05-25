Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-05-25
Source of Truth: Feature-owned verification catalog for Dungeon Editor tool
behavior proof and future view-driven behavior tests.

# Dungeon Editor Tool Behavior Verification Catalog

## Purpose

This document defines the catalog that a narrow Dungeon Editor behavior-test
suite must satisfy before the tool family can be called feature complete. It
owns testable input/result coverage only. Requirements remain owned by
[Dungeon Editor Requirements](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/dungeon/requirements/requirements-dungeon-editor.md:1),
persistence meaning remains owned by
[Dungeon Persistence Contract](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/dungeon/contract/contract-dungeon-persistence.md:1),
and project-wide gate policy remains owned by
[Quality Platforms Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/verification/quality-platforms.md:1).

## Scope Boundary

- The future suite is a user-requested narrow exception to the project default
  of manual behavior testing.
- The suite must not become a general behavior-regression platform, fixture
  harness selftest layer, or new broad Gradle gate unless explicitly requested.
- This catalog does not define new product behavior. It maps required editor
  behavior to observable proof points.
- Cases marked `Implementation Gap`, `Input Route Gap`, or
  `Behavior Ambiguous` are part of the required feature surface, but they are
  not ready-to-automate cases until the named gap is resolved.

## Proof Model

Each future behavior test should drive the actual View route where possible:

1. Build user input through the owning view control or JavaFX event handler.
2. Let the normal view input event, intent handler, application service,
   domain mutation, persistence, publication, and render-model cycle run.
3. Check the correct owner for the interaction:
   authored geometry in the SQLite-backed repository and
   `DungeonEditorSurface.map` or `previewMap`, editor session state in
   `DungeonEditorMapSurfaceSnapshot`, and camera/render state in
   `DungeonMapContentModel.CanvasState`.
4. Check the published editor surface: `DungeonEditorMapSurfaceSnapshot`
   selection, preview, projection level, overlay settings, selected tool, and
   nested `DungeonEditorSurface` when the operation touches authored truth.
5. Check the rendered view model or render scene for the same coordinates,
   topology refs, labels, preview state, visual kind, and viewport state.

Direct construction of `*ViewInputEvent` or published commands is allowed only
as a marked fallback when the real View route does not currently expose the
interaction. Such tests must carry `Input Route Gap` until the View route is
added.

## Evidence Shape

The expected output format for each non-gap test is:

- `inputRoute`: the view and control or event that built the input
- `fixture`: the named authored map fixture
- `db`: table rows or repository readback records that must exist, change, or
  remain absent for authored mutations; `none` for presentation-only changes
- `snapshot`: published `DungeonEditorMapSurfaceSnapshot` and nested
  `DungeonEditorSurface` facts owned by the interaction
- `render`: rendered cell, edge, marker, preview, camera, level, overlay, or
  selection state at the relevant coordinates

The current storage and publication surfaces support these assertions through
`dungeon_rooms`, `dungeon_room_clusters`, `dungeon_room_cluster_edges`,
`dungeon_room_cluster_vertices`, `dungeon_room_floors` level anchors,
`dungeon_corridors`, corridor binding tables, `dungeon_stairs`, stair path/exit
tables, `dungeon_transitions`, topology elements, `DungeonEditorMapSnapshot`
area, boundary, feature, and handle collections, `DungeonEditorMapSurfaceSnapshot`
projection/overlay/selection state, and `DungeonMapContentModel.CanvasState`
viewport state.

## Fixture Catalog

| Fixture | Purpose | Required authored shape |
| --- | --- | --- |
| `F0_EMPTY_MAP` | Empty baseline | One map, no rooms, no clusters, no corridors, no stairs, no transitions, active level `0`. |
| `F1_SINGLE_ROOM` | Room, wall, door, narration, and selection baseline | Rectangular room at level `0` with floor cells, one cluster, perimeter wall boundaries, no doors. |
| `F2_ADJACENT_ROOMS` | Adjacent-not-overlap room behavior | Two rooms sharing a side-adjacent border but no overlapping floor cell. |
| `F3_OVERLAPPING_ROOM_TARGET` | Merge behavior | Existing room whose floor cells overlap the next painted rectangle. |
| `F4_WALLED_ROOM_WITH_DOOR` | Door, corridor endpoint, and deletion behavior | Room with authored perimeter wall and one authored door on an outer edge. |
| `F5_CORRIDOR_WITH_ANCHOR` | Corridor route, anchor, waypoint, and deletion behavior | Two rooms with a corridor, a door binding, at least one corridor anchor, and one turn. |
| `F6_MULTI_LEVEL_FLOORS` | Level, onion slicing, floor crossing, and stairs | Rooms or floors on levels `0`, `1`, and `2` with projection controls enabled. |
| `F7_STAIR_ANCHOR` | Stair geometry editing | A stair with an anchor/path node, exits on at least two levels, and editable dimensions. |

## Status Vocabulary

| Status | Meaning |
| --- | --- |
| `Ready` | Expected behavior, route, persistence, snapshot, and render assertions are concrete enough for a view-driven test. |
| `Implementation Gap` | Required feature behavior is not sufficiently implemented end to end. |
| `Input Route Gap` | Domain or model surface exists, but the corresponding real View route is absent or not exposed. |
| `Behavior Ambiguous` | Required behavior text or live implementation leaves at least one observable result unclear. |
| `Deferred` | Required by a neighboring target-state surface, but outside the first implementation wave unless explicitly promoted. |

## Verification Matrix

| ID | Interaction | Route | Fixture | Input | Expected persistence | Expected snapshots | Expected render state | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| DE-CAM-001 | Camera pan right | `DungeonMapView` middle mouse press, drag, release | `F1_SINGLE_ROOM` | Drag canvas from `(300, 300)` to `(420, 300)` | No authored DB row changes | `DungeonEditorMapSurfaceSnapshot` and nested map unchanged; `CanvasState.viewport.panX` increases by `120`, `panY` and `zoom` unchanged | Same render scene primitives shift right under the changed viewport | Ready |
| DE-CAM-002 | Camera pan left | `DungeonMapView` middle mouse press, drag, release | `F1_SINGLE_ROOM` | Drag `(420, 300)` to `(300, 300)` | No authored DB row changes | Surface snapshot unchanged; `CanvasState.viewport.panX` decreases by `120`, `panY` and `zoom` unchanged | Same render scene primitives shift left under the changed viewport | Ready |
| DE-CAM-003 | Camera pan down | `DungeonMapView` middle mouse press, drag, release | `F1_SINGLE_ROOM` | Drag `(300, 300)` to `(300, 420)` | No authored DB row changes | Surface snapshot unchanged; `CanvasState.viewport.panY` increases by `120`, `panX` and `zoom` unchanged | Same render scene primitives shift down under the changed viewport | Ready |
| DE-CAM-004 | Camera pan up | `DungeonMapView` middle mouse press, drag, release | `F1_SINGLE_ROOM` | Drag `(300, 420)` to `(300, 300)` | No authored DB row changes | Surface snapshot unchanged; `CanvasState.viewport.panY` decreases by `120`, `panX` and `zoom` unchanged | Same render scene primitives shift up under the changed viewport | Ready |
| DE-CAM-005 | Zoom in around cursor | `DungeonMapView` scroll event | `F1_SINGLE_ROOM` | Wheel delta `+120` at cursor over room cell `(2, 2, 0)` | No authored DB row changes | Surface snapshot unchanged; `CanvasState.viewport.zoom` increases and `panX`/`panY` are recalculated by `Viewport.zoomAround` for the cursor point | Cursor-anchored scene coordinate remains stable while grid size increases | Ready |
| DE-CAM-006 | Zoom out around cursor | `DungeonMapView` scroll event | `F1_SINGLE_ROOM` | Wheel delta `-120` at cursor over room cell `(2, 2, 0)` | No authored DB row changes | Surface snapshot unchanged; `CanvasState.viewport.zoom` decreases and `panX`/`panY` are recalculated by `Viewport.zoomAround` for the cursor point | Cursor-anchored scene coordinate remains stable while grid size decreases | Ready |
| DE-LVL-001 | Projection level up by visible control | `DungeonEditorControlsView` next-level button | `F6_MULTI_LEVEL_FLOORS` | Click `+` level control | No authored DB row changes | `DungeonEditorMapSurfaceSnapshot.projectionLevel` increments by `1`; map truth unchanged | Render uses the next active level and prior level only through overlay rules | Ready |
| DE-LVL-002 | Projection level down by visible control | `DungeonEditorControlsView` previous-level button | `F6_MULTI_LEVEL_FLOORS` | Click `-` level control | No authored DB row changes | `DungeonEditorMapSurfaceSnapshot.projectionLevel` decrements by `1`; map truth unchanged | Render uses the previous active level and prior level only through overlay rules | Ready |
| DE-LVL-003 | Projection level up by shortcut | `DungeonEditorControlsView` or map-surface key route after Q/E is exposed | `F6_MULTI_LEVEL_FLOORS` | Press `E` | No authored DB row changes | Projection level increments by `1`; map truth unchanged | Render uses the next active level | Input Route Gap |
| DE-LVL-004 | Projection level down by shortcut | `DungeonEditorControlsView` or map-surface key route after Q/E is exposed | `F6_MULTI_LEVEL_FLOORS` | Press `Q` | No authored DB row changes | Projection level decrements by `1`; map truth unchanged | Render uses the previous active level | Input Route Gap |
| DE-OVR-001 | Onion slicing off through current inline controls | `DungeonEditorControlsView` overlay controls | `F6_MULTI_LEVEL_FLOORS` | Select overlay mode `off` | No authored DB row changes | `DungeonEditorMapSurfaceSnapshot.overlaySettings` records off/empty selection | Only active level is rendered as active surface | Ready |
| DE-OVR-002 | Onion slicing nearby range through current inline controls | `DungeonEditorControlsView` overlay mode, range spinner, opacity slider | `F6_MULTI_LEVEL_FLOORS` | Select nearby mode, range `1`, opacity `0.35` | No authored DB row changes | `overlaySettings` records nearby mode, range, opacity | Adjacent levels render with non-active opacity, active level remains primary | Ready |
| DE-OVR-003 | Onion slicing selected levels through current inline controls | `DungeonEditorControlsView` overlay mode and selected-levels text field | `F6_MULTI_LEVEL_FLOORS` | Select explicit mode and enter `-1,1,2` | No authored DB row changes | `overlaySettings` records selected-level mode and selected levels text | Only selected non-active levels render as onion slices | Ready |
| DE-OVR-004 | Onion slicing control popup | Overlay trigger popup after the requested popup route is exposed | `F6_MULTI_LEVEL_FLOORS` | Open popup, select mode/range/opacity, dismiss or apply | No authored DB row changes | `overlaySettings` records the popup result only after committed popup input | Popup state is visible while open; render updates to chosen onion settings after input | Input Route Gap |
| DE-SEL-001 | Select cluster | `DungeonMapView` primary click built from hit target | `F1_SINGLE_ROOM` | Click cluster floor or handle at `(2, 2, 0)` | No authored DB row changes | Inspector selects stable cluster/room topology ref | Selected cluster/room highlight appears at matching coordinates | Ready |
| DE-SEL-002 | Select door | `DungeonMapView` primary click built from boundary hit target | `F4_WALLED_ROOM_WITH_DOOR` | Click door edge | No authored DB row changes | Inspector selects door topology ref and owning room/cluster | Door marker or edge receives selected styling | Ready |
| DE-SEL-003 | Select stair | `DungeonMapView` primary click built from feature or stair handle hit target | `F7_STAIR_ANCHOR` | Click stair anchor marker | No authored DB row changes | Inspector selects stair topology ref and exposes stair handles | Stair marker and path render as selected | Implementation Gap |
| DE-SEL-004 | Select corridor | `DungeonMapView` primary click built from corridor/anchor hit target | `F5_CORRIDOR_WITH_ANCHOR` | Click corridor segment or anchor | No authored DB row changes | Inspector selects corridor or corridor-anchor topology ref | Corridor segment or anchor renders as selected | Ready |
| DE-STATE-001 | Edit room narration | `DungeonEditorStateView` text areas and save button | `F4_WALLED_ROOM_WITH_DOOR` | Change visual description and exit description, click save | `dungeon_rooms.visual_description` and `dungeon_room_exit_descriptions` update | Inspector/narration cards show saved text after reload | State panel text areas show saved values | Ready |
| DE-STATE-002 | Door-specific state panel input | State panel door card after requirements and contract define the editable door fields | `F4_WALLED_ROOM_WITH_DOOR` | Select door and edit the defined door-specific field | No concrete persistence assertion until the field owner is defined; bound-door deletion rejection remains covered by door deletion cases | Inspector exposes editable door fields only after the owner defines them | Selected door remains highlighted; label or marker changes only if the adopted field affects rendering | Behavior Ambiguous |
| DE-STATE-003 | Stair dimensions and shape | State panel stair card | `F7_STAIR_ANCHOR` | Select stair, edit shape, direction, dimensions | `dungeon_stairs.shape`, `direction`, `dimension1`, `dimension2` update; path/exits recompute | Stair feature and handles reflect recomputed geometry | Stair marker/path/exits render at recomputed cells | Implementation Gap |
| DE-STATE-004 | Corridor point edit | State panel corridor card or view handle drag fallback | `F5_CORRIDOR_WITH_ANCHOR` | Select corridor point, edit coordinates or drag point | Waypoint/anchor rows update or are replaced consistently | Corridor area/handles reflect edited route | Corridor segments redraw as straight pieces between route points | Implementation Gap |
| DE-ROOM-001 | Paint isolated room | `DungeonEditorControlsView` room tool then `DungeonMapView` drag rectangle | `F0_EMPTY_MAP` | Drag rectangle from `(1, 1, 0)` to `(3, 3, 0)` and release | One room, one cluster, cluster vertices/edges for the rectangle, level anchor row as needed, and topology refs | One room area with cells `(1..3,1..3,0)`, boundaries on perimeter, no preview after finish | Floors and walls render at painted coordinates | Ready |
| DE-ROOM-002 | Paint overlapping room merges | Room tool plus `DungeonMapView` drag rectangle | `F3_OVERLAPPING_ROOM_TARGET` | Paint rectangle overlapping existing room cells | Existing room/cluster expands or merges; no duplicate overlapping rooms | Snapshot has one merged area/cluster covering union | One continuous room/cluster renders with merged perimeter | Ready |
| DE-ROOM-003 | Paint adjacent room does not merge | Room tool plus `DungeonMapView` drag rectangle | `F2_ADJACENT_ROOMS` | Paint rectangle that touches but does not overlap existing room | New room/cluster rows are created; existing rows unchanged except topology ordering | Two distinct room areas/clusters; adjacent cells remain separate ownership | Two adjacent rooms render with separate selectable authored targets | Ready |
| DE-ROOM-004 | Delete room rectangle | Delete-room tool plus `DungeonMapView` drag rectangle | `F1_SINGLE_ROOM` | Drag delete rectangle over room cells | Room/cluster geometry is updated through vertices/edges and level anchors; empty room or cluster records are pruned when no authored cells remain | Removed cells absent from areas; boundaries recomputed | Deleted cells render as empty; surrounding walls update | Ready |
| DE-WALL-001 | Start wall preview from vertex | Wall tool plus `DungeonMapView` vertex click | `F1_SINGLE_ROOM` | Click first vertex point | No authored DB row changes | `previewMap` or preview state shows draft wall start | Draft point/segment preview appears at vertex | Ready |
| DE-WALL-002 | Finalize wall | Wall tool plus `DungeonMapView` existing wall click or right-click finish fallback | `F1_SINGLE_ROOM` | Click second vertex or existing wall to finish | New cluster edge/topology row for wall segment | Boundaries include new wall segment; preview clears | Solid wall renders along finalized edge | Behavior Ambiguous |
| DE-WALL-003 | Move preview point | Wall tool plus `DungeonMapView` drag draft point | `F1_SINGLE_ROOM` | Drag preview vertex before finalization | No authored DB row changes | Preview endpoint coordinates update only in preview state | Draft wall preview follows moved point | Ready |
| DE-WALL-004 | Delete wall or corner-adjacent segments | Delete-wall tool plus selected edge or corner | `F1_SINGLE_ROOM` | Click wall edge; repeat on corner selection | Edge row removed; corner selection removes adjacent edge rows | Boundaries omit deleted edge or adjacent edge set | Removed wall edges render as open floor boundary | Ready |
| DE-DOOR-001 | Create door on wall | Door tool plus `DungeonMapView` wall click | `F1_SINGLE_ROOM` | Click outer wall edge | Edge row or door override becomes door topology | Boundary kind changes from wall to door at exact edge | Door marker/edge renders at clicked wall | Ready |
| DE-DOOR-002 | Delete door | Delete-door tool plus `DungeonMapView` door click | `F4_WALLED_ROOM_WITH_DOOR` | Click existing door | Door topology is removed or converted back to wall per resolved requirement | Boundary kind updates consistently and corridor-bound doors reject deletion | Door marker disappears or wall edge reappears at same edge | Behavior Ambiguous |
| DE-COR-001 | Create door-to-door corridor avoiding rooms | Corridor tool plus two door clicks | `F4_WALLED_ROOM_WITH_DOOR` | Select door A then door B with rooms between | New corridor, endpoint bindings, topology refs, and route points avoid authored room cells | Corridor area cells/handles connect explicit door refs; exact cell path follows the route algorithm under test | Straight segments render around rooms, not through room interiors | Behavior Ambiguous |
| DE-COR-002 | Create door-to-anchor corridor | Corridor tool plus door click then anchor click | `F5_CORRIDOR_WITH_ANCHOR` | Click door, then existing corridor anchor | New corridor binds door and anchor without duplicate endpoint | Snapshot has corridor area and reused anchor ref; exact route follows the route algorithm under test | New route renders from door to anchor | Behavior Ambiguous |
| DE-COR-003 | Create anchor-to-anchor corridor | Corridor tool plus two anchor clicks | `F5_CORRIDOR_WITH_ANCHOR` | Click anchor A then anchor B | New corridor binds both existing anchors | Snapshot has corridor area between chosen anchor refs; exact route follows the route algorithm under test | New route renders between anchors | Behavior Ambiguous |
| DE-COR-004 | Split corridor at turns or crossings | Corridor creation route | `F5_CORRIDOR_WITH_ANCHOR` | Create route with a turn and crossing | Waypoints/anchors represent straight segment split points | Snapshot exposes separate straight segments or handles at split points | Render shows straight corridor pieces joined at corners/crossings | Behavior Ambiguous |
| DE-COR-005 | Move corridor connection point | Select tool plus `DungeonMapView` anchor/waypoint drag | `F5_CORRIDOR_WITH_ANCHOR` | Drag connection point from `(4, 2, 0)` to `(4, 4, 0)` | Anchor/waypoint row coordinates update | Corridor cells and handles recompute around new point | Connected straight segments redraw from moved point | Implementation Gap |
| DE-COR-006 | Delete connection point and reroute | Delete-corridor or selected-point delete route | `F5_CORRIDOR_WITH_ANCHOR` | Delete intermediate waypoint | Waypoint row removed; replacement route persisted | Snapshot route is recalculated between remaining endpoints | Corridor redraws as shortest valid route | Implementation Gap |
| DE-COR-007 | Delete door connection removes corridor span | Delete-corridor route on door binding | `F5_CORRIDOR_WITH_ANCHOR` | Delete door connection at endpoint | Corridor span is removed up to nearest crossing or door; unaffected branches remain | Snapshot omits removed segment and stale handles | Removed route no longer renders; remaining branches still render | Implementation Gap |
| DE-COR-008 | Invalid route rejected | Corridor tool plus impossible endpoints | `F1_SINGLE_ROOM` | Select endpoints whose shortest route would cross room interior with no valid bypass | No new corridor, binding, anchor, or waypoint rows | Status/inspector reports rejection; map and preview clear or remain unchanged | No committed corridor appears | Behavior Ambiguous |
| DE-STAIR-001 | Create straight stair | Stair create control is absent from current visible tool row | `F7_STAIR_ANCHOR` | Choose straight shape and place from anchor after route exists | Stair row, path nodes, exits, and topology refs created | Stair feature, exits, and handles appear | Straight stair path and exits render | Input Route Gap |
| DE-STAIR-002 | Create square spiral stair | Stair create control is absent from current visible tool row | `F7_STAIR_ANCHOR` | Choose angular spiral and place from anchor after route exists | Stair shape/dimensions/path/exits persist | Feature cells follow angular spiral geometry | Spiral path renders with angular turns | Input Route Gap |
| DE-STAIR-003 | Create round spiral stair | Stair create control is absent from current visible tool row | `F7_STAIR_ANCHOR` | Choose round spiral and place from anchor after route exists | Stair shape/dimensions/path/exits persist | Feature cells approximate round spiral geometry | Round spiral footprint renders | Input Route Gap |
| DE-STAIR-004 | Edit stair dimensions | State panel stair editor | `F7_STAIR_ANCHOR` | Change diameter or side lengths | Dimension fields update and path/exits recompute | Feature and handles reflect recomputed geometry | Stair footprint updates without losing anchor | Implementation Gap |
| DE-STAIR-005 | Anchor-preserving recompute | State panel or handle drag | `F7_STAIR_ANCHOR` | Move selected connection/anchor then recompute | Anchor identity remains; dependent path/exits update | Same stair topology ref with changed cells | Geometry redraws from selected anchor | Implementation Gap |
| DE-STAIR-006 | Floor crossing creates exits | Stair creation/edit route | `F6_MULTI_LEVEL_FLOORS` | Create stair crossing floor levels `0` and `1` | Stair exits rows created at every crossed floor | Feature exits list contains each floor crossing | Exit markers render on every crossed floor | Implementation Gap |
| DE-STAIR-007 | Invalid stair geometry rejected | Stair creation/edit route | `F7_STAIR_ANCHOR` | Try sudden 180-degree turn or impossible dimensions | No partial stair/path/exit mutation persists | Status reports rejection; previous stair remains unchanged | Invalid preview does not become committed render state | Implementation Gap |
| DE-STAIR-008 | Cross-level corridor creates stair segment | Corridor tool between doors on different levels | `F6_MULTI_LEVEL_FLOORS` | Connect level `0` door to level `1` door | Corridor plus stair segment rows persist with consistent bindings | Corridor area and stair feature connect endpoints | Corridor renders to stair segment and exit on both levels | Implementation Gap |
| DE-TRN-001 | Create transition | Transition tool view route | `F6_MULTI_LEVEL_FLOORS` | Place transition and set destination | Transition row with cell, destination, and topology ref persists | Transition feature appears with destination label | Transition marker renders at selected cell | Input Route Gap |
| DE-TRN-002 | Delete transition | Transition delete view route | `F6_MULTI_LEVEL_FLOORS` | Select transition and delete | Transition row removed or rejected if linked | Feature disappears or status reports protected link | Transition marker disappears only when deletion succeeds | Input Route Gap |
| DE-TRN-003 | Bidirectional transition link | Transition state panel route | `F6_MULTI_LEVEL_FLOORS` | Enable bidirectional destination link | Linked transition fields update consistently | Both transition features expose paired destination labels | Both markers remain selectable and linked | Input Route Gap |

## Catalog Completion Criteria

The catalog is complete enough to start implementation when every required row
has:

- a real View route or an explicit `Input Route Gap`
- a named fixture
- concrete persisted-output assertions
- concrete published-snapshot assertions
- concrete rendered-state assertions
- an explicit status that distinguishes feature work from test harness work

The future implementation is complete only when all non-deferred required
interactions have real View routes, all `Implementation Gap`,
`Input Route Gap`, and `Behavior Ambiguous` rows are resolved or deliberately
re-scoped in requirements, and the narrow behavior suite passes from a named
repo command.

## Current Review-Owned Gaps

- Q/E level shortcuts are user-required. The current read found ready level
  buttons and projection shift input in `DungeonEditorControlsView`, but not a
  proven Q/E View route.
- Onion slicing is user-required as a control popup. The current read found
  ready inline overlay controls and a disabled overlay trigger, so popup-driven
  cases remain input-route gaps even though overlay settings have a visible
  inline control route.
- `DungeonEditorTool` includes stair and transition tools, and presentation
  labels exist, but the visible controls currently expose only select, room,
  wall, door, and corridor families.
- The current state panel exposes room narration input. Door, corridor, stair,
  and transition editors need concrete View routes before their state-panel
  cases can be automated through the full input cycle.
- Door deletion must be clarified against the requirement that corridor-bound
  doors reject deletion. The user wording "click on door deletes wall" must be
  reconciled with whether deletion removes the door, restores a wall, or removes
  an entire wall segment.

## Verification Route

This documentation-only catalog pass is mechanically checked by:

```bash
./gradlew checkDocumentationEnforcement --console=plain
```

Later production-code or test-harness implementation must use the smallest
documented focused route during development and the production-code handoff
route required by `AGENTS.md` before final handoff.

## References

- [Documentation Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/documentation.md:1)
- [Quality Platforms Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/verification/quality-platforms.md:1)
- [Dungeon Editor Requirements](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/dungeon/requirements/requirements-dungeon-editor.md:1)
- [Dungeon Persistence Contract](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/dungeon/contract/contract-dungeon-persistence.md:1)
- [Dungeon Persistence Schema](/home/aaron/Schreibtisch/projects/SaltMarcher/src/data/dungeon/model/DungeonPersistenceSchema.java:5)
- [Dungeon Editor Tool Enum](/home/aaron/Schreibtisch/projects/SaltMarcher/src/domain/dungeon/published/DungeonEditorTool.java:3)
- [Dungeon Editor Surface](/home/aaron/Schreibtisch/projects/SaltMarcher/src/domain/dungeon/published/DungeonEditorSurface.java:5)
- [Dungeon Editor Map Surface Snapshot](/home/aaron/Schreibtisch/projects/SaltMarcher/src/domain/dungeon/published/DungeonEditorMapSurfaceSnapshot.java:5)
- [Dungeon Editor Map Snapshot](/home/aaron/Schreibtisch/projects/SaltMarcher/src/domain/dungeon/published/DungeonEditorMapSnapshot.java:6)
- [Dungeon Map ContentModel Canvas State](/home/aaron/Schreibtisch/projects/SaltMarcher/src/view/slotcontent/main/dungeonmap/DungeonMapContentModel.java:175)
- [Dungeon Map View Input Builder](/home/aaron/Schreibtisch/projects/SaltMarcher/src/view/slotcontent/main/dungeonmap/DungeonMapView.java:181)
- [Dungeon Editor Controls View](/home/aaron/Schreibtisch/projects/SaltMarcher/src/view/leftbartabs/dungeoneditor/DungeonEditorControlsView.java:184)
- [Dungeon Editor State View](/home/aaron/Schreibtisch/projects/SaltMarcher/src/view/leftbartabs/dungeoneditor/DungeonEditorStateView.java:65)
