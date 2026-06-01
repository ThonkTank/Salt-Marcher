Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-05-28
Source of Truth: Feature-owned verification catalog for Dungeon Editor tool
behavior proof and future view-driven behavior tests.

# Dungeon Editor Tool Behavior Verification Catalog

## Purpose

This document defines the catalog that a narrow Dungeon Editor behavior-test
suite must satisfy before the tool family can be called feature complete. It
owns testable input/result coverage only; requirements, persistence meaning,
and project-wide gate policy remain owned by the linked canonical references.

## Scope Boundary

- The future suite is a user-requested narrow exception to the project default
  of manual behavior testing.
- The suite must not become a general behavior-regression platform, fixture
  harness selftest layer, or new broad Gradle gate unless explicitly requested.
- This catalog does not define new product behavior. It maps required editor
  behavior to observable proof points.
- Cases marked `Implementation Gap`, `Input Route Gap`, `Harness Gap`, or
  `Behavior Ambiguous` are part of the required feature surface, but they are not
  ready-to-automate cases until the named gap is resolved.

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

Tool-family route proof follows the owning requirements: one focused
`DungeonEditorControlsView` button selects each editor tool family, LMB or
primary map input selects or places the normal authored target, RMB or
secondary map input deletes or removes the target, and Shift-modified map
input performs the family's alternate edit action when that family defines one.
Separate top-level create/delete buttons for one family are current-state
evidence only, not automation-ready target routes.
The focused family-button row is proved in a `960px` wide app window and must
fit inside the normal tool panel rather than moving subactions such as stair
create/delete into separate top-level buttons.
Secondary tool options that choose a mode, shape, destination kind, link
behavior, or other parameter value are proved through a dropdown window
anchored under the focused family button. The dropdown must preselect the last
used sub-option for that family, or the first available sub-option when no
previous selection exists, and must close automatically when the pointer leaves
the dropdown window area.

## Evidence Shape

The expected output format for each automation-ready row is:

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
`dungeon_room_cluster_vertices`, `dungeon_room_floors` cross-level anchors,
`dungeon_corridors`, corridor binding tables, `dungeon_stairs`, stair path/exit
tables, `dungeon_transitions`, topology elements, `DungeonEditorMapSnapshot`
area, boundary, feature, and handle collections, `DungeonEditorMapSurfaceSnapshot`
projection/overlay/selection state, and `DungeonMapContentModel.CanvasState`
viewport state.

Fresh room-paint rows do not require persisted `dungeon_room_cluster_edges`
perimeter rows, and same-level room cells are not represented by one
`dungeon_room_floors` row per cell. The persisted room component, cluster
center, and cluster vertices must read back to the expected cell set while the
published snapshot/render surface derives the perimeter walls. Rows that use
seeded fixtures may still assert explicit seeded edge rows when the fixture
purpose needs a stable wall or door target.

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
| `F14_LARGE_STORED_VERTEX_MAP` | Startup/input responsiveness for legacy or pathological persisted room loops | One persisted map containing one room whose cluster stores at least 56,000 per-cell loop vertex rows in `dungeon_room_cluster_vertices`; the fixture intentionally represents persisted DB state that is legal to keep in the catalog but must not be loaded synchronously just because the app shell starts. |

## Status Vocabulary

| Status | Meaning |
| --- | --- |
| `Ready` | Expected behavior, route, persistence, snapshot, and render assertions are concrete enough for a view-driven test. |
| `Implementation Gap` | Required feature behavior is not sufficiently implemented end to end. |
| `Input Route Gap` | Domain or model surface exists, but the corresponding real View route is absent or not exposed. |
| `Harness Gap` | The real View route exists, but focused behavior-harness proof is absent or incomplete. |
| `Behavior Ambiguous` | Required behavior text or live implementation leaves at least one observable result unclear. |
| `Re-scoped` | A formerly cataloged interaction is explicitly not required by the owning requirements and is retained only as a traceable non-feature row. |

## Tool Gesture Convention

Rows that place, delete, or alternate-edit authored geometry assume this target
route unless a row names a stricter gesture:

- select exactly one visible family button in `DungeonEditorControlsView`
- use LMB or primary map input for the family's normal place or select flow
- use RMB or secondary map input for the family's delete or remove flow
- use Shift-modified map input only for the family's alternate edit flow when
  that family defines one; families without a defined alternate edit route do
  not route Shift-modified input to delete or another family action
- apply the same convention across room, wall, door, corridor, stair, and
  transition families
- expose secondary family options in a dropdown under the focused family button
  only when input gestures cannot separate the options cleanly
- preselect the last used family sub-option, or the first sub-option when the
  family has no prior selection
- close the dropdown automatically when the pointer leaves its window area
- reset tool family and sub-option state to `Auswahl` when `Esc` is pressed

Rows that currently depend on separate top-level create/delete buttons remain
input-route gaps until the family-button plus shared-gesture route is exposed.

Stair rows use the `StairGeometrySpec` clarified by the requirements, domain,
and persistence contract. The stair shape dropdown only seeds creation shape;
selected-stair shape, direction, dimensions, and exit span are state-panel
owned. Clarified stair semantics make future implementation planning concrete.
Straight-stair state-panel direction/dimension recompute is covered by the
focused harness, so `DE-STATE-003` is `Ready`; square-stair creation is covered
by `DE-STAIR-002`; round-stair creation is covered by `DE-STAIR-003`;
`DE-STAIR-007` now proves state-panel zero-span/out-of-range dimension,
state-panel room-interior crossing rejection, real View shape/direction
constraints, generated-path uniqueness for the proved supported editor shapes,
straight-stair creation room-interior crossing rejection, and cross-level
corridor-owned stair creation.

## Verification Matrix

| ID | Interaction | Route | Fixture | Input | Expected persistence | Expected snapshots | Expected render state | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| DE-MAP-001 | Create map | `DungeonEditorControlsView` map create action and submit | `F9_MAP_CATALOG` | Open create dialog, enter `Gamma`, submit | New `dungeon_maps` row named `Gamma`; new map starts with no authored geometry rows | Map catalog includes `Gamma`; selected surface has map name `Gamma`, empty map, no preview | Render shows empty editor map/placeholder for the created map | Ready |
| DE-MAP-002 | Rename map | `DungeonEditorControlsView` map rename action and submit | `F9_MAP_CATALOG` | Select `Alpha`, open rename dialog, enter `Alpha Prime`, submit | Selected `dungeon_maps.name` changes to `Alpha Prime`; authored geometry rows unchanged | Map catalog and surface map name show `Alpha Prime`; selection remains on the same map id | Render scene content is unchanged except map title/name surfaces | Ready |
| DE-MAP-003 | Delete map | `DungeonEditorControlsView` map delete action and confirm | `F9_MAP_CATALOG` | Select `Beta`, open delete dialog, confirm | `Beta` map row and cascading authored rows are removed; `Zeta` and `Alpha` map rows remain; `Alpha` authored rows remain unchanged | Catalog omits `Beta`; selected map falls back to first remaining catalog map `Alpha`, even though `Zeta` has the lower inserted id; transient selection and preview clear; status reports deletion | Deleted `Beta` cells `(10..11,10..11,0)` no longer render; fallback `Alpha` cells `(1..3,1..3,0)` render instead of `Zeta` cells | Ready |
| DE-MAP-004 | Load map | `DungeonEditorControlsView` map selector | `F9_MAP_CATALOG` | Select `Beta` from map selector | No authored DB row changes | Selected map id changes to `Beta`; surface map name is `Beta`; surface map contains exactly room `B1` cells `(10..11,10..11,0)` and no doors or corridors | Render scene shows only `Beta` room `B1` at `(10..11,10..11,0)` | Ready |
| DE-MAP-005 | Reload map | `DungeonEditorControlsView` reload menu item | `F9_MAP_CATALOG` | Reload currently selected map after repository state changes | No additional authored DB row changes beyond the external persisted change | Surface is rebuilt from persisted authored state; selected map remains unchanged; preview and transient drafts clear | Render scene reflects persisted state and not stale preview state | Ready |
| DE-START-001 | Startup remains responsive with large persisted vertex loops in the catalog | `AppBootstrap` discovered shell startup into the Dungeon Editor controls and `DungeonMapView` key route | `F14_LARGE_STORED_VERTEX_MAP` | Seed a 56k-scale persisted vertex-loop fixture as external DB state before shell creation, start the real discovered app shell, verify the large map is catalog-visible but not auto-loaded, select the room family, then press `Esc` on the map surface | No authored DB row changes beyond the explicit external fixture seed; the persisted cluster vertex rows remain present at 56k scale | The large persisted map appears in the catalog without becoming the selected map during startup; startup completes within a deterministic app-shell latency bound; `Esc` returns selected tool state to `SELECT` within a deterministic key-input latency bound | Render-facing state stays on the unloaded-map placeholder during startup and remains able to process the post-start key route | Ready |
| DE-CAM-001 | Camera pan right | `DungeonMapView` middle mouse press, drag, release | `F1_SINGLE_ROOM` | Drag canvas from `(300, 300)` to `(420, 300)` | No authored DB row changes | `DungeonEditorMapSurfaceSnapshot` and nested map unchanged; `CanvasState.viewport.panX` increases by `120`, `panY` and `zoom` unchanged | Same render scene primitives shift right under the changed viewport | Ready |
| DE-CAM-002 | Camera pan left | `DungeonMapView` middle mouse press, drag, release | `F1_SINGLE_ROOM` | Drag `(420, 300)` to `(300, 300)` | No authored DB row changes | Surface snapshot unchanged; `CanvasState.viewport.panX` decreases by `120`, `panY` and `zoom` unchanged | Same render scene primitives shift left under the changed viewport | Ready |
| DE-CAM-003 | Camera pan down | `DungeonMapView` middle mouse press, drag, release | `F1_SINGLE_ROOM` | Drag `(300, 300)` to `(300, 420)` | No authored DB row changes | Surface snapshot unchanged; `CanvasState.viewport.panY` increases by `120`, `panX` and `zoom` unchanged | Same render scene primitives shift down under the changed viewport | Ready |
| DE-CAM-004 | Camera pan up | `DungeonMapView` middle mouse press, drag, release | `F1_SINGLE_ROOM` | Drag `(300, 420)` to `(300, 300)` | No authored DB row changes | Surface snapshot unchanged; `CanvasState.viewport.panY` decreases by `120`, `panX` and `zoom` unchanged | Same render scene primitives shift up under the changed viewport | Ready |
| DE-CAM-005 | Zoom in around cursor | `DungeonMapView` scroll event | `F1_SINGLE_ROOM` | Wheel delta `+120` at cursor over room cell `(2, 2, 0)` | No authored DB row changes | Surface snapshot unchanged; `CanvasState.viewport.zoom` increases and `panX`/`panY` are recalculated by `Viewport.zoomAround` for the cursor point | Cursor-anchored scene coordinate remains stable while grid size increases | Ready |
| DE-CAM-006 | Zoom out around cursor | `DungeonMapView` scroll event | `F1_SINGLE_ROOM` | Wheel delta `-120` at cursor over room cell `(2, 2, 0)` | No authored DB row changes | Surface snapshot unchanged; `CanvasState.viewport.zoom` decreases and `panX`/`panY` are recalculated by `Viewport.zoomAround` for the cursor point | Cursor-anchored scene coordinate remains stable while grid size decreases | Ready |
| DE-LVL-001 | Projection level up by visible control | `DungeonEditorControlsView` next-level button | `F6_MULTI_LEVEL_FLOORS` | Click `+` level control | No authored DB row changes | `DungeonEditorMapSurfaceSnapshot.projectionLevel` increments by `1`; map truth unchanged | Render uses the next active level and prior level only through overlay rules | Ready |
| DE-LVL-002 | Projection level down by visible control | `DungeonEditorControlsView` previous-level button | `F6_MULTI_LEVEL_FLOORS` | Start with projection level `1`, then click `-` level control | No authored DB row changes | `DungeonEditorMapSurfaceSnapshot.projectionLevel` decrements from `1` to `0`; map truth unchanged | Render uses level `0` as active and prior level only through overlay rules | Ready |
| DE-LVL-003 | Projection level up by shortcut | `DungeonMapView` map-surface key route | `F6_MULTI_LEVEL_FLOORS` | Press `E` | No authored DB row changes | Projection level increments by `1`; map truth unchanged | Render uses the next active level | Ready |
| DE-LVL-004 | Projection level down by shortcut | `DungeonMapView` map-surface key route | `F6_MULTI_LEVEL_FLOORS` | Press `Q` | No authored DB row changes | Projection level decrements by `1`; map truth unchanged | Render uses the previous active level | Ready |
| DE-VIEW-001 | Switch to graph projection | `DungeonEditorControlsView` graph view toggle | `F1_SINGLE_ROOM` | Click `Graph` view control | No authored DB row changes | `DungeonEditorMapSurfaceSnapshot.viewMode` becomes `GRAPH`; map truth unchanged | Render scene uses graph projection for the same authored topology | Ready |
| DE-VIEW-002 | Switch to grid projection | `DungeonEditorControlsView` grid view toggle | `F1_SINGLE_ROOM` | Start in graph mode, then click `Grid` view control | No authored DB row changes | `DungeonEditorMapSurfaceSnapshot.viewMode` becomes `GRID`; map truth unchanged | Render scene uses grid projection for the same authored topology | Ready |
| DE-OVR-001 | Onion slicing off through current inline controls | `DungeonEditorControlsView` overlay controls | `F6_MULTI_LEVEL_FLOORS` | Select overlay mode `off` | No authored DB row changes | `DungeonEditorMapSurfaceSnapshot.overlaySettings` records off/empty selection | Only active level is rendered as active surface | Ready |
| DE-OVR-002 | Onion slicing nearby range through current inline controls | `DungeonEditorControlsView` overlay mode, range spinner, opacity slider | `F6_MULTI_LEVEL_FLOORS` | Select nearby mode, range `1`, opacity `0.35` | No authored DB row changes | `overlaySettings` records nearby mode, range, opacity | Adjacent levels render with non-active opacity, active level remains primary | Ready |
| DE-OVR-003 | Onion slicing selected levels through current inline controls | `DungeonEditorControlsView` overlay mode and selected-levels text field | `F6_MULTI_LEVEL_FLOORS` | Select explicit mode and enter `-1,1,2` | No authored DB row changes | `overlaySettings` records selected-level mode and selected levels text | Only selected non-active levels render as onion slices | Ready |
| DE-OVR-004 | Onion slicing control popup | `DungeonEditorControlsView` overlay trigger popup | `F6_MULTI_LEVEL_FLOORS` | Open popup, select nearby mode, range `1`, and opacity `0.35`, then dismiss | No authored DB row changes | `overlaySettings` records the popup result after committed popup input | Popup state is visible while open; render updates to chosen onion settings after input | Ready |
| DE-SEL-001 | Select cluster | `DungeonMapView` primary click built from hit target | `F1_SINGLE_ROOM` | Click cluster floor or handle at `(2, 2, 0)` | No authored DB row changes | Inspector selects stable cluster/room topology ref | Selected cluster/room highlight appears at matching coordinates | Ready |
| DE-SEL-002 | Select door | `DungeonMapView` primary click built from boundary hit target | `F4_WALLED_ROOM_WITH_DOOR` | Click door edge | No authored DB row changes | Inspector selects door topology ref and owning room/cluster | Door marker or edge receives selected styling | Ready |
| DE-SEL-003 | Select stair | `DungeonMapView` primary click built from feature or stair handle hit target | `F7_STAIR_ANCHOR` | Click stair anchor marker | No authored DB row changes | Inspector selects stair topology ref and exposes stair handles | Stair marker and active-level path cell render as selected | Ready |
| DE-SEL-004 | Select corridor | `DungeonMapView` primary click built from corridor/anchor hit target | `F5_CORRIDOR_WITH_ANCHOR` | Click corridor segment or anchor | No authored DB row changes | Inspector selects corridor or corridor-anchor topology ref | Corridor segment or anchor renders as selected | Ready |
| DE-SEL-005 | Empty-grid click clears selection | `DungeonMapView` primary click built from empty hit target | `F1_SINGLE_ROOM` | Select room, then click empty cell outside authored geometry | No authored DB row changes | `DungeonEditorMapSurfaceSnapshot.selection` becomes empty and inspector clears | Selected highlight disappears; empty cell remains empty | Ready |
| DE-SEL-006 | Move selected editor handle | Select tool plus `DungeonMapView` drag on a published corridor-anchor handle | `F5_CORRIDOR_WITH_ANCHOR` | Drag corridor anchor handle `A1` from `(6,5,0)` to `(6,4,0)` | `dungeon_corridor_anchors.cell_x=6`, `cell_y=4`, `cell_z=0` for existing `anchor_id=A1`; `host_corridor_id` and `topology_element_id` remain stable; no new corridor row, anchor ref churn, or waypoint-row churn is introduced | Selection stays on the same anchor/corridor topology ref; corridor area and handles recompute | Anchor marker renders at `(6,4,0)` and connected corridor segments redraw | Ready |
| DE-SEL-007 | Stretch selected straight cluster wall | Select tool plus `DungeonMapView` straight wall drag | `F1_SINGLE_ROOM` | Drag north wall segment `(1,1,0) -> (4,1,0)` outward to y `0` | `C1` and `R1` keep the same stable ids; authored cells become `(1..3,0..3,0)`; stored cluster vertices read back to absolute `(1,0,0)`, `(4,0,0)`, `(4,4,0)`, `(1,4,0)`; north/east/west edge rows recompute as one cluster mutation with no duplicate wall topology and no independent wall delete/recreate rows | Selection stays on the same cluster topology ref; `DungeonEditorSurface.map` exposes the expanded area, recomputed north/east/west boundaries, and no preview after release | North wall renders at `y=0`; east and west walls extend to the moved north wall; the newly enclosed row renders as room floor | Ready |
| DE-SEL-008 | Move selected wall corner with adjacent segments | Select tool plus `DungeonMapView` drag on a published cluster-corner handle | `F1_SINGLE_ROOM` | Drag south-east corner handle from `(4,4,0)` to `(5,5,0)` | `C1` and `R1` keep the same identity; the south-east stored vertex becomes `(5,5,0)`; east and south boundary spans recompute as one cluster mutation with no orphan wall topology rows or duplicate wall rows | Selection stays on `C1`; affected boundaries and corner handle recompute without independent wall delete/recreate state | Corner handle renders at `(5,5,0)` and both connected wall segments redraw to the new point | Ready |
| DE-SEL-009 | Move selected cluster as a whole | Select tool plus `DungeonMapView` cluster-label drag route | `F1_SINGLE_ROOM` | Select `C1`, drag the selected cluster by delta `(+2,+1,0)`, and release | `C1` keeps the same identity; room/cluster anchor and all owned floor, vertex, edge, door, and topology coordinates translate by `(+2,+1,0)`; no duplicate `R1/C1` rows are created | Selection stays on `C1`; area cells become `(3..5,2..4,0)` and boundaries/handles translate by the same delta | The whole selected room/cluster renders at the translated coordinates with unchanged shape | Ready |
| DE-STATE-001 | Edit room narration | `DungeonEditorStateView` text areas and save button | `F4_WALLED_ROOM_WITH_DOOR` | Set room visual text to `Wet stone walls.` and east-exit text to `Iron-banded door east.`, then click save | `dungeon_rooms.visual_description='Wet stone walls.'` for `R1`; `dungeon_room_exit_descriptions` row for `room_id=R1`, `cell_x=3`, `cell_y=2`, `edge_direction=EAST` has `description='Iron-banded door east.'` | Inspector/narration cards show both saved strings after reload | State panel text areas show both saved strings | Ready |
| DE-STATE-002 | Door-specific state panel input | No required editable door-specific state-panel route | `F4_WALLED_ROOM_WITH_DOOR` | Select door and inspect the state panel | No authored DB row changes; room exit narration remains covered by `DE-STATE-001`, and door create/delete/protected-delete behavior remains covered by door rows | Selection may expose the stable door target and protected-delete status, but no editable door-only field is required by `requirements-dungeon-editor.md` | Selected door remains highlighted; no door label or marker change is expected from state-panel editing because there is no required door-only edit | Re-scoped |
| DE-STATE-003 | Stair dimensions and shape | State panel stair card | `F7_STAIR_ANCHOR` | Select `S1`; change shape, cardinal direction, `dimension1`, and `dimension2` within the `StairGeometrySpec` bounds | `dungeon_stairs.shape`, `direction`, `dimension1`, and `dimension2` update as one stair spec; `dungeon_stair_path_nodes` and `dungeon_stair_exits` recompute; stair id and topology ref remain stable | Stair feature and handles reflect the recomputed path and exits; selection stays on `S1` | Stair marker, active-level path cells, and generated exits render at recomputed cells | Ready |
| DE-STATE-004 | Corridor point edit from state panel | `DungeonEditorStateView` corridor point card reusing the selected published handle route | `F5_CORRIDOR_WITH_ANCHOR` | Select corridor anchor `A1`, edit `r` from `5` to `4`, then submit the state-panel move | Existing `dungeon_corridor_anchors` row for `A1` moves to `(6,4,0)`; `host_corridor_id`, topology ref, corridor rows, endpoint refs, and waypoint rows remain stable; no duplicate anchor is created | Selection stays on the same anchor handle; move preview clears; the published corridor handle and corridor area include the edited point | Anchor marker and render-facing corridor state appear at `(6,4,0)`; reload keeps the moved anchor | Ready |
| DE-PREVIEW-001 | Room preview does not persist before completion | Room tool plus `DungeonMapView` press and drag without release | `F0_EMPTY_MAP` | Press at `(1,1,0)`, drag to `(3,3,0)`, do not release | No room, cluster, vertex, edge, floor anchor, or topology rows are written yet | `DungeonEditorMapSurfaceSnapshot.preview` is `RoomRectanglePreview(start=(1,1,0), end=(3,3,0), deleteMode=false)`; committed `surface.map` remains empty | Draft room renders as preview only, not as committed floor/walls | Ready |
| DE-PREVIEW-002 | Cancel draft without commit | Room tool plus `DungeonMapView` press/drag preview, then `Esc` on the map surface | `F0_EMPTY_MAP` | Start room draft from `(1,1,0)` to `(3,3,0)`, then press `Esc` before release | No authored DB row changes | Preview clears to `none`; selected tool returns to `SELECT`; committed `map` remains unchanged | Preview render disappears and no committed geometry appears | Ready |
| DE-TOOL-001 | Family button row fits 960px tool panel | `DungeonEditorControlsView` focused tool-family button row | `F0_EMPTY_MAP` | Display the editor in a `960px` wide app window with the normal tool-panel layout | No authored DB row changes | Selected tool state unchanged | Tool-family buttons remain inside the tool panel without separate top-level create/delete variants, including stair create/delete subactions | Ready |
| DE-TOOL-002 | Secondary option dropdown opens under family button | `DungeonEditorControlsView` family button dropdown | `F0_EMPTY_MAP` | Open the stair family dropdown with supported secondary shape options that cannot be separated by map input | No authored DB row changes | Stair family remains active and `Gerade` is selected by default; `Eckspirale` and `Rundspirale` are visible and selectable supported creation options | Dropdown window appears anchored under the focused family button | Ready |
| DE-TOOL-003 | Secondary option dropdown restores prior sub-option | `DungeonEditorControlsView` family button dropdown | `F0_EMPTY_MAP` | Select a non-default supported stair sub-option, close the dropdown, then reopen the same family dropdown | No authored DB row changes | Family sub-option state records the last selected supported sub-option | Reopened dropdown preselects the last selected supported sub-option; first option is preselected only when no prior selection exists | Ready |
| DE-TOOL-004 | Secondary option dropdown auto-closes on pointer leave | `DungeonEditorControlsView` family button dropdown | `F0_EMPTY_MAP` | Open a secondary-option dropdown, then move the pointer outside the dropdown window area | No authored DB row changes | Selected family and last sub-option remain unchanged | Dropdown window closes without requiring a second click | Ready |
| DE-TOOL-005 | Escape resets to selection tool | `DungeonMapView` key route covered by `dungeonEditorBehaviorHarness` | `F0_EMPTY_MAP` | Activate a non-selection family, then press `Esc` on the map surface | No authored DB row changes | `DungeonEditorMapSurfaceSnapshot.selectedTool` and controls state return to `Auswahl` | Selection tool appears active; no current family popup is visible | Ready |
| DE-TOOL-006 | Escape clears secondary-option dropdown intent | `DungeonEditorControlsView` secondary-option dropdown key route | `F0_EMPTY_MAP` | Open or select a secondary-option dropdown intent, then press `Esc` while the dropdown is active | No authored DB row changes | Tool family, active sub-option intent, controls state, and map-surface tool state return to `Auswahl`; reopening the family falls back to the first option | Secondary-option dropdown closes and no selected-family dropdown remains open | Ready |
| DE-ROOM-001 | Paint isolated room | `DungeonEditorControlsView` room tool then `DungeonMapView` drag rectangle | `F0_EMPTY_MAP` | Drag rectangle from `(1, 1, 0)` to `(3, 3, 0)` and release | One `dungeon_rooms` row with `component_x=1`, `component_y=1`, `level_z=0`; one `dungeon_room_clusters` row with `center_x=1`, `center_y=1`, `level_z=0`; no extra same-level `dungeon_room_floors` anchors are required; persisted cluster vertex rows/rasterized readback cover exactly cells `(1..3,1..3,0)` and include absolute outside corners `(1,1,0)`, `(4,1,0)`, `(4,4,0)`, `(1,4,0)`; no persisted cluster-edge perimeter rows are required | One room area with cells `(1..3,1..3,0)`, derived perimeter boundaries, and no preview after finish | Floors render at painted coordinates and derived perimeter walls render around the room | Ready |
| DE-ROOM-002 | Paint overlapping room merges | `DungeonEditorControlsView` room tool then `DungeonMapView` drag rectangle | `F3_OVERLAPPING_ROOM_TARGET` | Paint rectangle `(3..5,2..4,0)` over existing `R1` | Existing `R1/C1` ids survive; exactly one room/cluster owns the set union of existing cells `(1..3,1..3,0)` and painted cells `(3..5,2..4,0)`; overlap cells `(3,2,0)` and `(3,3,0)` are not duplicated; unpainted bounding-box cells such as `(4,1,0)`, `(5,1,0)`, `(1,4,0)`, and `(2,4,0)` are not added; persisted cluster vertex rows/rasterized readback cover exactly that union; no second room/cluster is created; old boundary rows that now fall inside the union are removed or ignored so they cannot publish stale internal walls | Snapshot has one merged area with the set-union cells, one cluster topology ref, derived or explicit perimeter boundaries around the union, no stale internal wall artifacts, and no preview after release | One continuous room/cluster renders with merged floor cells and perimeter around the union; no old internal wall renders at former `R1` boundaries now inside the union | Ready |
| DE-ROOM-003 | Paint adjacent room does not merge | `DungeonEditorControlsView` room tool then `DungeonMapView` drag rectangle | `F1_SINGLE_ROOM` | Paint rectangle `(4..6,1..3,0)`, directly adjacent to `R1` but with no overlapping cell | A new `R2/C2` is created with component/center `(4,1,0)`; no extra same-level `dungeon_room_floors` anchors are required for `R2`; `R1/C1` rows remain unchanged; `C2` persisted cluster vertex rows/rasterized readback cover cells `(4..6,1..3,0)` and include absolute outside corners `(4,1,0)`, `(7,1,0)`, `(7,4,0)`, `(4,4,0)`; no persisted cluster-edge perimeter rows are required; no shared cell ownership or merge row churn occurs | Two distinct room areas/clusters exist with separate topology refs, derived perimeter boundaries, and no overlapping cell ownership; preview clears after release | Adjacent rooms render side by side with separate selectable authored targets and distinct perimeters | Ready |
| DE-ROOM-004 | Delete whole room rectangle | Room family button plus shared secondary delete gesture on `DungeonMapView` | `F1_SINGLE_ROOM` | Select the room family, use secondary drag delete rectangle `(1..3,1..3,0)` over every `R1` cell, and release | No `dungeon_rooms`, `dungeon_room_clusters`, cluster vertex, cluster edge, room floor, room exit description, or topology rows remain for `R1/C1`; unrelated map rows and other maps remain unchanged | `areas`, `boundaries`, and handles omit `R1/C1`; selection and preview clear | Cells `(1..3,1..3,0)` render as empty map space with no room floor or perimeter walls | Ready |
| DE-WALL-001 | Start wall preview from vertex | `DungeonEditorControlsView` wall family button then `DungeonMapView` vertex click | `F1_SINGLE_ROOM` | Click internal vertex `(2,1,0)` | No authored DB row changes; no internal wall rows exist until a candidate path is finalized | Selected tool is `WALL_CREATE`; boundary-draft start is retained by the domain route, published preview stays `none` until pointer movement supplies a candidate endpoint, and the next movement to `(2,4,0)` publishes a wall preview | No committed internal wall renders before candidate movement; candidate movement adds the transient wall preview | Ready |
| DE-WALL-002 | Finalize wall | `DungeonEditorControlsView` wall family button then `DungeonMapView` vertex movement and release | `F1_SINGLE_ROOM` | Start at `(2,1,0)`, move candidate endpoint to `(2,4,0)`, release at `(2,4,0)` | Exactly three internal wall edge/topology rows are created for `(2,1,0) -> (2,4,0)`; preview state is not persisted | Boundaries include exactly one finalized internal wall path and preview clears | Solid wall renders along `(2,1,0) -> (2,4,0)` | Ready |
| DE-WALL-003 | Move preview point | `DungeonEditorControlsView` wall family button then `DungeonMapView` pointer movement while a wall draft is armed | `F1_SINGLE_ROOM` | Start at `(2,1,0)`, move draft endpoint from `(2,4,0)` to `(3,4,0)` before finalization | No authored DB row changes | Preview endpoint changes to `(3,4,0)` only in preview state; committed map remains unchanged | Draft wall preview follows the internal route from `(2,1,0)` to `(3,4,0)` and includes the final edge to `(3,4,0)` | Ready |
| DE-WALL-004 | Delete wall through boundary path | Wall family button plus shared secondary delete gesture on `DungeonMapView` boundary-path workflow | `F1_SINGLE_ROOM` | Select the wall family, start delete path at `(1,1,0)` with secondary input, drag along north wall to `(4,1,0)`, and release | North wall keyed edge rows persist as authored `OPEN` rows with no topology refs; north wall `WALL` rows and wall topology refs are removed; unrelated east/south/west wall rows, room row, and cluster row remain | Drag publishes a wall delete preview for the north path; after release boundaries omit the north wall path and preview clears | North wall no longer renders; east, south, and west walls remain | Ready |
| DE-WALL-005 | Delete selected wall segment directly | Wall family button plus shared delete gesture on a boundary target | `F1_SINGLE_ROOM` | Use the shared delete gesture on the middle north wall segment | The selected north edge/topology row is marked open according to wall-delete semantics; adjacent north wall edges and unrelated perimeter rows remain | Boundaries omit the selected north segment while other perimeter edges remain | Selected north wall segment no longer renders; adjacent north, east, south, and west walls remain | Ready |
| DE-WALL-006 | Delete corner-adjacent wall segments directly | Wall family button plus shared delete gesture on a corner target | `F1_SINGLE_ROOM` | Use the shared delete gesture on corner `(1,1,0)` | North and west adjacent edge rows are marked open together | Boundaries omit both edges adjacent to `(1,1,0)` while neighboring wall segments remain | North and west wall segments no longer render at that corner; next adjacent north and west wall segments still render | Ready |
| DE-WALL-007 | Finalize wall by alternate edit gesture | `DungeonEditorControlsView` wall family button plus shared Shift-secondary alternate-edit gesture on `DungeonMapView` | `F1_SINGLE_ROOM` | Start wall preview at `(2,1,0)`, move candidate endpoint to `(2,4,0)`, then use Shift-secondary release at `(2,4,0)` to finalize | The same finalized wall rows as `DE-WALL-002` are created for `(2,1,0) -> (2,4,0)` | Boundaries include the finalized segment and preview clears | Solid wall renders along `(2,1,0) -> (2,4,0)` | Ready |
| DE-DOOR-001 | Create door on wall | Door tool plus `DungeonMapView` wall click | `F1_SINGLE_ROOM` | Click east boundary `absolute_cell=(3,2,0)`, `edge_direction=EAST` | `dungeon_room_cluster_edges` for `C1`, `cell_x=1`, `cell_y=0`, `level_z=0`, `edge_direction=EAST` has `edge_type=DOOR` and a door topology element id, because `C1` center is `(2,2,0)` and boundary cells persist cluster-relative coordinates | Boundary kind changes from wall to door at absolute `cell=(3,2,0)`, `edge_direction=EAST` | Door marker/edge renders at the clicked east wall | Ready |
| DE-DOOR-002 | Delete door | Door family button plus shared secondary delete gesture on `DungeonMapView` door hit | `F4_WALLED_ROOM_WITH_DOOR` | Use the shared delete gesture on unbound `D1`; repeat with `D1` corridor-bound in a variant fixture | Unbound `D1` loses door topology/semantic binding and the same boundary segment becomes a wall; corridor-bound `D1` rejects deletion with no door, corridor, room-boundary, or preview mutation | Unbound case changes boundary kind from door to wall and clears preview; bound case keeps the published door and leaves preview unchanged | Unbound case removes the door marker and renders the wall edge at the same boundary; bound case leaves the door marker unchanged | Ready |
| DE-COR-001 | Create door-to-door corridor avoiding rooms | Corridor family button plus two `DungeonMapView` door hits | `F8_TWO_DOOR_ROUTE_TARGET` | Select `D1` at `(4,2,0)`, then `D2` at `(7,2,0)` | One new corridor row, endpoint bindings to `D1` and `D2`, topology refs, and explicit straight route cells `(4,2,0)`, `(5,2,0)`, `(6,2,0)`, `(7,2,0)` persist for the catalog fixture; no route cell overlaps authored room interiors | Corridor area cells/handles connect the explicit door refs; preview clears after commit | Straight corridor segment renders between the two door markers and outside room interiors | Ready |
| DE-COR-002 | Create door-to-anchor corridor | Corridor family button plus `DungeonMapView` door hit then anchor hit | `F5_CORRIDOR_WITH_ANCHOR` | Click door `D1`, then existing corridor anchor `A1` | One new corridor binds `D1` and existing `A1`; no duplicate door or anchor is created; route cells follow the valid orthogonal candidate from `(4,2,0)` to `(6,5,0)` without crossing room interiors | Snapshot has the new corridor area, endpoint binding to `D1`, reused anchor ref `A1`, and no preview after commit | New route renders from the door marker to anchor `A1` | Ready |
| DE-COR-003 | Create anchor-to-anchor corridor | Corridor family button plus two `DungeonMapView` anchor hits | `F10_TWO_ANCHOR_ROUTE_TARGET` | Click anchor `A1`, then anchor `A2` | One new corridor binds existing anchors `A1` and `A2`; no duplicate anchors are created; route cells run horizontally from `(2,6,0)` through `(8,6,0)` | Snapshot has one new corridor area between the chosen anchor refs and keeps both original anchor topology refs stable | New route renders between anchors `A1` and `A2` | Ready |
| DE-COR-004 | Split corridor at a crossing | Corridor family button plus `DungeonMapView` door hits on `D1` and crossing-route target `D3` | `F5_CORRIDOR_WITH_ANCHOR` proof variant | Create a route from `D1` to `D3` whose deterministic route crosses existing corridor `K1` at `(6,5,0)` | The committed corridor owns the proved route cells `(4,2,0)`, `(5,2,0)`, `(6,2,0)`, `(6,3,0)`, `(6,4,0)`, `(6,5,0)`, `(6,6,0)`, `(6,7,0)`, `(6,8,0)` split at `(6,5,0)`; exactly one authored anchor exists at the crossing cell and is reused as the crossing point; exactly one persisted split waypoint records `(6,5,0)` for the new corridor; no unnecessary anchors are created inside straight spans | Snapshot exposes the proved corridor cells, the reused authored anchor handle, and exactly one split waypoint handle at `(6,5,0)` | Render shows the proved joined corridor pieces and the reused anchor marker at `(6,5,0)` | Ready |
| DE-COR-005 | Move corridor connection point by view handle | Select tool plus `DungeonMapView` published corridor-anchor handle drag | `F5_CORRIDOR_WITH_ANCHOR` | Drag corridor anchor `A1` from `(6,5,0)` to `(6,4,0)` | `dungeon_corridor_anchors.cell_x=6`, `cell_y=4`, `cell_z=0` for existing `anchor_id=A1`; `host_corridor_id` and `topology_element_id` remain stable; linked corridor route readback updates without creating a new corridor, replacing anchor refs, or churning unrelated waypoint rows | Corridor area and handles recompute around `A1`; same anchor topology ref remains selected | Connected straight corridor segments redraw through `(6,4,0)` | Ready |
| DE-COR-006 | Delete connection point and reroute | Corridor family button plus shared delete gesture on selected point or waypoint | `F5_CORRIDOR_WITH_ANCHOR` | Use the shared delete gesture on corridor connection point `A1` at `(6,5,0)` | The selected `A1` waypoint/anchor-ref row is removed; route cells between door endpoint cells `(4,2,0)` and `(7,2,0)` persist as `(4,2,0)`, `(5,2,0)`, `(6,2,0)`, `(7,2,0)` using the normal deterministic policy; if replacement is invalid, no row changes persist | Snapshot clears selection and preview, recalculates the route between the surviving door endpoints, and omits the stale `A1` handle | Corridor redraws through `(4,2,0)` to `(7,2,0)`; no `A1` waypoint marker remains | Ready |
| DE-COR-007 | Delete door connection removes corridor span | Corridor family button plus shared delete gesture on door binding | `F5_CORRIDOR_WITH_ANCHOR` | Use the shared delete gesture on door connection `D1` at endpoint cell `(4,2,0)` | The branch segment from `D1` to the nearest surviving authored corridor point `A1` is removed; the route segment from `A1` to `D2`, surviving topology refs, and unrelated authored rows remain | Snapshot omits the removed `D1` span and stale endpoint handle while preserving surviving `A1` and `D2` refs | Removed route no longer renders from `D1` to `A1`; remaining branch from `A1` to `D2` still renders with stable selection targets | Ready |
| DE-COR-008 | Invalid route rejected | Corridor family button plus two `DungeonMapView` wall hits whose horizontal-first and vertical-first candidates are both blocked | `F11_BLOCKED_CORRIDOR_ROUTE` | Click `R2` east wall, then click `R3` west wall so both orthogonal candidates would cross `R1` interior cells `(1..3,1..3,0)` outside a concrete door endpoint | No new corridor, binding, anchor, door, waypoint, or topology rows persist; the pre-existing room and wall rows remain byte-for-byte unchanged | Status reports route rejection; committed map is unchanged; preview clears or remains absent | No committed corridor appears and existing room render is unchanged | Ready |
| DE-COR-009 | Generic room hit materializes door endpoint | Corridor family button plus generic room hit then `DungeonMapView` door hit | `F12_ROOM_TO_DOOR_ROUTE_TARGET` | Click room `R1` interior without selecting a boundary, then click `D2` | The generic room hit resolves to the east edge facing `D2`; exactly one door is authored on that edge before corridor commit; no duplicate door appears on the same edge | Corridor endpoint binds to the newly authored door topology ref, never to a generic room id; preview clears after commit | Corridor route starts at the materialized door marker and renders to `D2` | Ready |
| DE-COR-010 | Generic corridor hit reuses existing anchor endpoint | Corridor family button plus generic `DungeonMapView` corridor-cell hit | `F5_CORRIDOR_WITH_ANCHOR` | Click corridor `K1` body at host cell `(6,5,0)` without selecting `A1`, then click door `D1` | Existing exact anchor `A1` is reused when the hit cell matches; no duplicate anchor appears on the same host corridor cell and anchor rows are unchanged | Corridor endpoint binds to explicit corridor-anchor topology ref `A1`, never to a generic corridor id; preview clears after commit | Corridor route starts at the reused anchor marker | Ready |
| DE-COR-011 | Generic corridor hit materializes absent anchor endpoint | Corridor tool plus generic corridor body hit | `F5_CORRIDOR_WITH_ANCHOR` | Click corridor `K1` body at an unanchored host cell without selecting an anchor, then click door `D1` | Exactly one `dungeon_corridor_anchors` row/topology ref is authored on host corridor `K1` at the clicked cell before corridor commit; no duplicate anchor appears on the same host corridor cell | Corridor endpoint binds to the newly authored corridor-anchor topology ref, never to a generic corridor id; preview clears after commit | Corridor route starts at the newly materialized anchor marker | Ready |
| DE-STAIR-001 | Create straight stair | Stair family button plus shared place gesture | `F1_SINGLE_ROOM` | Select the stair family, choose `Gerade`/`STRAIGHT`, place anchor `(6,6,0)` outside the room footprint, direction `NORTH`, `dimension1=3`, `dimension2=1` | One stair row persists with shape `STRAIGHT`, direction `NORTH`, dimensions `3/1`, generated path nodes, generated exits, and a stable stair topology ref | Stair feature, generated exits, and stair handles appear with no preview after commit | Straight stair path and exits render on crossed levels | Ready |
| DE-STAIR-002 | Create square spiral stair | Stair family button plus shared place gesture and square stair workflow | `F7_STAIR_ANCHOR` | Select `Eckspirale`/`SQUARE`, then place an anchor with the shared primary map gesture | Stair spec persists as `SQUARE` with default `NORTH`, `dimension1=3`, and `dimension2=1`; generated angular-spiral path nodes and exits persist; stair topology ref is stable | Feature cells and handles follow the square footprint and crossed levels | Angular spiral footprint, path, and exits render | Ready |
| DE-STAIR-003 | Create round spiral stair | Stair family button plus shared place gesture and circular stair workflow | `F7_STAIR_ANCHOR` | Select `Rundspirale`/`CIRCULAR`, then place an anchor with the shared primary map gesture | Stair spec persists as `CIRCULAR` with default `NORTH`, `dimension1=3`, and `dimension2=1`; generated round-spiral path nodes and exits persist; stair topology ref is stable | Feature cells approximate the circular footprint and crossed levels | Round spiral footprint, path, and exits render | Ready |
| DE-STAIR-004 | Edit stair dimensions | State panel stair editor | `F7_STAIR_ANCHOR` | Select `S1`; change `dimension1`, `dimension2`, or direction within the selected straight-stair bounds, then attempt a zero-level span | Dimension fields update and path/exits recompute atomically; the zero-level edit rejects without DB mutation | Feature and handles reflect recomputed geometry or keep prior geometry after rejection | Stair footprint updates without losing anchor; rejected edits leave prior render state | Ready |
| DE-STAIR-005 | Move stair path anchor by view handle | Select tool plus `DungeonMapView` published stair-anchor handle drag | `F7_STAIR_ANCHOR` | Drag lower stair path handle from `(2,2,0)` to `(3,2,0)` | Existing `dungeon_stair_path_nodes` lower path node moves to `(3,2,0)`; `dungeon_stair_exits` rows remain at their prior coordinates; `dungeon_stairs` identity, shape, dimensions, and stair topology ref remain stable | Same stair topology ref stays selected; move-handle preview is published during drag; committed snapshot clears preview, moves the first stair handle to `(3,2,0)`, and keeps the lower exit cell `(2,2,0)` | Preview handle renders at `(3,2,0)` during drag; after release the committed stair path cell and handle render at `(3,2,0)` and read back after reload | Ready |
| DE-STAIR-006 | Floor crossing creates exits | Stair state-panel edit route | `F7_STAIR_ANCHOR` | Recompute selected straight stair `S1` with `dimension2=2` from level `0` to level `2` | Exit rows exist for levels `0`, `1`, and `2`; labels follow `Ausgang z=<level> (<q>,<r>)`; stable exit ids are preserved by level role on recompute | Feature cells and generated stair handles expose every crossed level | Exit markers render on every crossed floor | Ready |
| DE-STAIR-007 | Invalid stair geometry rejected | Stair creation/edit route | `F7_STAIR_ANCHOR` | Try zero-level span, out-of-range dimensions, or a path crossing room interior outside exits. The focused harness proves real `DungeonEditorStateView` zero-span, out-of-range dimension, room-interior crossing, and constrained shape/direction inputs that cannot emit unsupported shape or non-cardinal direction values, plus the real `DungeonEditorControlsView`/`DungeonMapView` straight-stair creation route whose generated path would cross room interior cells outside generated exits. | No partial stair, path, exit, topology, corridor binding, selection, or preview mutation persists; generated stair path cells remain unique for the supported editor shapes used by the proved routes | Status reports rejection; previous stair and selection remain unchanged. The proved invalids keep DB rows, selected stair or tool state, snapshot map, preview, and render-facing active-level cells unchanged. | Invalid preview does not become committed render state | Ready |
| DE-STAIR-008 | Cross-level corridor creates stair segment | Corridor tool between doors on different levels | `F6_MULTI_LEVEL_FLOORS` | Connect a level `0` door to a level `1` door | Corridor plus one corridor-bound stair segment persist with consistent corridor id, generated path, exits, and topology refs | Corridor area and bound stair feature connect endpoints across levels | Corridor renders to the stair segment and exit on both levels | Ready |
| DE-STAIR-009 | Delete stair | Stair family button plus shared secondary delete gesture on `DungeonMapView` stair marker/handle | `F7_STAIR_ANCHOR` | Use the shared delete gesture on unbound `S1`; repeat with a corridor-bound stair variant | Unbound stair, path, exits, and topology ref are removed; bound stair deletion rejects unless the owning corridor branch is deleted | Stair feature and handles disappear only on successful deletion; rejection keeps prior snapshot and selection | Stair marker/path/exits disappear only when deletion succeeds | Ready |
| DE-STAIR-010 | Anchor-preserving full stair recompute | State panel stair editor | `F7_STAIR_ANCHOR` | Change selected straight stair direction and dimensions, then recompute path and exits from the preserved lower anchor | Stair id and topology ref remain stable; path and exits recompute from the current spec; exit ids are preserved by surviving level role | Same stair topology ref with recomputed cells, exits, and handles | Full straight-stair geometry redraws from the selected anchor and current parameters | Ready |
| DE-TRN-001 | Create transition | Transition family button plus `DungeonEditorStateView` destination parameter card plus shared primary place gesture on `DungeonMapView` | `F6_MULTI_LEVEL_FLOORS` | Select the transition family, set overworld destination map `77` and tile `88` in the parameter surface, then place transition at `(5,2,0)` | Transition row with cell `(5,2,0)`, overworld destination, and topology ref persists and remains after reload | Transition feature appears with destination label `Overworld-Feld 88` | Transition marker renders at selected cell | Ready |
| DE-TRN-002 | Delete transition | Transition family button plus shared delete gesture on `DungeonMapView` transition marker | `F13_TRANSITION_DESCRIPTION` | Use the shared delete gesture on an unlinked transition marker; repeat protected variants where the selected transition has `linkedTransitionId`, another loaded-map transition links to the selected id, and another loaded-map transition has a dungeon-map destination targeting the selected id | Unlinked transition row and topology ref are removed and remain absent after reload; protected variants leave all loaded-map transition and topology rows unchanged | Unlinked transition feature disappears and selection clears after successful deletion; protected variants keep projection, preview, and published map stable | Unlinked transition marker disappears after successful deletion; protected variant markers remain rendered | Ready |
| DE-TRN-003 | Bidirectional transition link | Transition state panel route with selected source transition, target map, target transition id, bidirectional option, and explicit save | `F13_TRANSITION_DESCRIPTION` | Select source transition `T1`, choose target map `M2` and target transition `T2`, enable bidirectional link, then save | Source transition destination fields target `T2`; target transition `linked_transition_id` points back to `T1`; invalid source, map, or target transition rejects with no transition-row mutation | Both transition features expose paired destination labels and linked delete protection through persisted readback, not draft state | Both markers remain selectable and linked after reload | Ready |
| DE-TRN-004 | Edit transition description | `DungeonMapView` transition selection plus `DungeonEditorStateView` transition description card | `F13_TRANSITION_DESCRIPTION` | Select transition `T1`, edit description to `Hidden stairwell to the cistern.`, and click save | `dungeon_transitions.description` updates only for the selected transition; destination, link, and cell fields remain unchanged | Transition feature and inspector expose the saved description after save and reload | State panel shows the saved description, the transition marker remains selected/rendered, and the transition does not expose the corridor-point edit card | Ready |
## Catalog Completion Criteria

The catalog is complete enough to start implementation when every required
interaction has either concrete proof expectations or an explicit gap status:

- a real View route, or an explicit `Input Route Gap` or `Harness Gap`
- a named fixture
- concrete persisted-output assertions for `Ready` rows
- concrete published-snapshot assertions for `Ready` rows
- concrete rendered-state assertions for `Ready` rows
- for gap or ambiguous rows, enough route, owner, or rule context to explain
  why the row is not automation-ready yet
- an explicit status that distinguishes feature work from test harness work

Rows are automation-ready only after their real View route, persistence owner,
published snapshot owner, and render assertion are concrete. The future
implementation is complete only when every required interaction has a real View
route, all `Implementation Gap`, `Input Route Gap`, `Harness Gap`, and `Behavior
Ambiguous` rows are resolved or deliberately re-scoped in requirements, and the
narrow behavior suite passes from a named repo command.

## Current Review-Owned Gaps

- Q/E level shortcuts are user-required and now have a map-surface key route
  through `DungeonMapView` covered by the focused harness.
- Onion slicing has both inline controls and overlay-trigger popup proof through
  `DungeonEditorControlsView`; popup-driven overlay settings are covered by
  `DE-OVR-004`.
- The target editor route is one visible button per tool family plus a shared
  map-surface gesture convention for place, delete, and alternate edit intent.
  Current separate top-level create/delete buttons are not final target routes.
- Family buttons with secondary options now have dropdown proof for anchored
  placement, selectable supported stair options, last-selection restoration,
  pointer-leave auto-close, and `Esc` clearing of active sub-option/dropdown
  intent through the focused stair shape-option route.
  Other families that later gain secondary options must use the same focused
  button/dropdown convention.
- `DungeonEditorTool` includes stair and transition tools, and visible controls
  collapse create/delete variants into family selection plus shared gestures.
  Transition creation is covered by `DE-TRN-001` through the family button,
  state-panel destination card, primary map gesture, persisted row/topology
  readback, and render marker proof; unlinked transition delete is covered by
  `DE-TRN-002`.
- The current state panel exposes room narration input, selected corridor-point
  editing, straight-stair geometry editing, and transition description editing
  through concrete `DungeonEditorStateView` routes. Selected-stair state-panel
  shape, direction, and dimension changes are Ready under `DE-STATE-003`
  because they recompute the selected stair spec, path nodes, and exits. New
  round stair creation is Ready under `DE-STAIR-003`; invalid stair geometry is
  Ready under `DE-STAIR-007` through real state-panel and map-view rejection
  routes plus constrained shape/direction inputs; transition creation
  destination selection now has a concrete state-panel parameter route for
  overworld destinations; bidirectional transition linking is Ready under
  `DE-TRN-003` through the real state-panel link route.
  Door-only editing remains re-scoped out of the required feature surface.
- Door deletion requirements are clarified as unbound door to wall restoration
  and corridor-bound protected rejection. The focused harness covers the real
  View route through the door family button and secondary map-surface delete
  gesture.
- Overlap room merge is covered by the focused harness: old boundary rows that
  become internal to the merged union no longer publish stale internal wall
  artifacts.

## Verification Route

This documentation-only catalog pass is mechanically checked by:

```bash
./gradlew checkDocumentationEnforcement --console=plain
```

Later production-code or test-harness implementation must use the smallest
documented focused route during development and the production-code handoff
route required by `AGENTS.md` before final handoff.

The focused view-driven Dungeon Editor behavior harness is:

```bash
./gradlew dungeonEditorBehaviorHarness --console=plain
```

The harness is intentionally feature-scoped. It uses isolated SQLite data under
`build/`, drives supported rows through the View boundary where implemented,
and records row-level proof in `build/dungeon-editor-behavior-results/summary.txt`.
It also owns the large persisted vertex-loop startup/input regression: start
the real discovered app shell against an isolated SQLite catalog containing the
pathological persisted map, prove startup does not synchronously load that map,
and prove a later map-surface key route remains responsive.

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
