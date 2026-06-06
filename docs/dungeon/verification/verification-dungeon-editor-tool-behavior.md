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

The verification matrix below owns behavior expectations by `DE-*` row; the
public harness summary owns row-level proof publication. Every published route
proof row must include `OwnerSuite`, `ProofType=RealRoute`, and the catalog
`DE-*` row id. Model-only invariant proofs cannot close catalog `Ready` rows
unless this catalog explicitly changes the row's proof type.

## Fixture Catalog

The canonical fixture table lives in
[Dungeon Editor Fixture Catalog](verification-dungeon-editor-fixtures.md).

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

The behavior matrix is split by route owner and harness suite group:

- [Map, projection, and controls](verification-dungeon-editor-map-controls.md)
- [Selection, rooms, walls, doors, and previews](verification-dungeon-editor-selection-room-wall-door.md)
- [Corridors](verification-dungeon-editor-corridors.md)
- [Stairs and transitions](verification-dungeon-editor-stairs-transitions.md)

These files own the row-level `DE-*` expectations; this document owns the
shared proof model, status vocabulary, gesture convention, route ownership, and
completion criteria. Model invariant rows use their own invariant ids and do
not close catalog `Ready` real-route rows.

Supplemental model-invariant proof rows are documented separately in
[Core model invariants](verification-dungeon-core-model-invariants.md). They
publish through the public aggregator as `ProofType=ModelInvariant`, but they
are not editor behavior matrix route rows.

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

The harness is intentionally feature-scoped. Its public Gradle entry stays one
aggregator, but package-level concern entrypoints split real-route behavior
from core model invariants:

- `DungeonEditorRouteBehaviorHarness` groups route suites that drive supported
  rows through the View boundary where implemented.
- `DungeonCoreModelInvariantHarness` groups model-only invariant suites
  documented in
  [Dungeon Core Model Invariants](verification-dungeon-core-model-invariants.md).

The route suites use isolated SQLite data under `build/`. The map-catalog suite
also owns the large persisted vertex-loop startup/input regression through the
discovered app shell.

The public aggregator serializes each whole invocation while publishing
`build/dungeon-editor-behavior-results/summary.txt`; per-run SQLite data remains
isolated, but the public summary is a single shared proof artifact.

Route ownership is:

- `DungeonEditorMapCatalogHarness`: `DE-MAP-*`, `DE-START-001`
- `DungeonEditorMapControlsHarness`: `DE-CAM-*`, `DE-TOOL-*`
- `DungeonEditorProjectionOverlayHarness`: `DE-LVL-*`, `DE-VIEW-*`, `DE-OVR-*`
- `DungeonEditorSelectionHarness`: `DE-SEL-001` through `DE-SEL-005`
- `DungeonEditorCorridorHarness`: `DE-SEL-006`, `DE-COR-*`, `DE-STATE-004`
- `DungeonEditorRoomWallDoorHarness`: `DE-SEL-007` through `DE-SEL-009`,
  `DE-STATE-001`, `DE-DOOR-*`, `DE-PREVIEW-*`, `DE-ROOM-*`, `DE-WALL-*`
- `DungeonEditorStairHarness`: `DE-STAIR-*`, `DE-STATE-003`
- `DungeonEditorTransitionHarness`: `DE-TRN-*`

All listed route-owned rows are `RealRoute` proofs. `DE-STATE-002` remains a
cataloged `Re-scoped` row and has no required harness proof owner.
Core model invariant rows are documented in
[Dungeon Core Model Invariants](verification-dungeon-core-model-invariants.md)
and publish `ProofType=ModelInvariant`.

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
