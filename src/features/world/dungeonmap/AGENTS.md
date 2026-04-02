# AGENTS.md

This file covers `src/features/world/dungeonmap/`. Use it together with the root `AGENTS.md`; root rules still apply unless this file narrows them for the dungeon feature.

## Scope

`dungeonmap` is a tile-grid dungeon editor and runtime surface inside Salt Marcher. Empty directories do not define architecture or ownership.

## Composition Root

- `bootstrap/DungeonMapModule` is the only feature composition root. It wires one shared `DungeonMapState`, `DungeonEditorSessionState`, `EditorInteractionState`, `DungeonHitCollector`, loading services, edit services, and exposes `DungeonRuntimeView` plus `DungeonEditorView`.
- Both views extend `shell/AbstractDungeonMapView`. That base class owns the view-local `DungeonCanvasWorkspace` and calls `DungeonMapLoadingService.ensureLoaded()` from `onShow()`.
- `DungeonViewMode` currently exposes the `GRID` projection. Additional modes must preserve the same direct-owner semantics across editor, runtime, and documentation.

## Current Architecture

- `CellCoord`, `GridPoint2x`, and `GridSegment2x` are the only canonical 2D primitives. Persisted odd/odd x2 coding stays at JDBC seams and must not leak back into model or UI owners.
- `DungeonLayout` is the immutable global lookup over direct structure owners: room clusters, corridors, stairs, transitions, connections, traversable cells, and spatial indexes.
- Corridors, stairs, and transitions are first-class persisted structures. There is no second aggregate that owns their geometry.
- `Room` and `Corridor` expose shared surface geometry only through `StructureObject`.
- `Corridor` keeps its node/segment graph as truth, stores node and route geometry directly as final `GridPoint2x`/`GridSegment2x`, and compiles it into the same `StructureDescriptor`/`StructureObject` surface model used by rooms, including opening segments for room-bound endpoints.
- Room paint/delete/boundary edits persist room-owned `StructureDescriptor` truth plus derived cluster metadata. They do not reroute or regenerate corridors or stairs.
- Connection doors and room exit narration are level-aware. Shared boundary/door queries must keep `levelZ` together with the 2x segment instead of collapsing identical segments across floors.
- `Wall` and `Door` are 2x-native boundary objects keyed by normalized `GridSegment2x` collections. Do not reintroduce vertex-edge wrapper geometry in productive wall/door flows.
- Tile-owned surfaces are owned as explicit `CellCoord` sets on `Floor` and other cell-surface seams. Do not reintroduce a second tile-area wrapper type just to shuttle those cells between owners.
- `StructureDescriptor.LevelDescriptor` authors room/corridor floor truth as `anchorCell`, `fillSeeds`, `boundaryEdges`, and `openingEdges`, with room/cluster descriptors carrying canonical `GridSegment2x` boundary edges in memory. `StructureObject` hydrates floors, walls, and doors from that cell/edge truth without reconstructing removed legacy tile wrappers.
- Room/cluster persistence keeps the existing `anchor_x2`/`seed_x2` odd/odd storage columns, but `DungeonRoomWriteRepository` and `DungeonMapLoader` must translate that storage coding to in-memory `CellCoord` plus final `GridSegment2x` instead of leaking DB parity into model owners.
- Interactive labels, editor boundary previews, and runtime door-number overlays anchor directly on final `GridPoint2x`/`GridSegment2x`. Canvas and hit-probe seams must not round-trip those overlays through legacy odd/odd parity.
- Runtime presentation resolves surfaces from the same structure owners used by the editor. Do not invent runtime-only structure mirrors.

## Package Roles

- `model/`
- `geometry/` owns pure grid math and routing primitives.
- `geometry/` keeps canonical cell-space on `CellCoord` and the final doubled-grid contract on `GridPoint2x`/`GridSegment2x`. Do not add secondary tile-area wrappers or old-parity bridge types as competing geometry owners.
  - `interaction/` owns model-side interaction seams such as `InteractiveLabelHandle`; semantic label identity lives here, not in canvas code.
- `objects/` owns thin domain objects over geometry such as `Floor`, `Wall`, `Door`, `StructureObject`, and `StructureDescriptor`. `Wall`/`Door` stay segment-based; shared boundary queries operate on `GridSegment2x`.
  - `structures/` owns first-class structures and the structure-specific subpackages `cluster`, `connection`, `corridor`, `room`, `stair`, and `transition`.
  - `DungeonLayout` stays the feature-wide lookup surface, not a second mutation owner.
- `application/`
  - `room/` owns room topology, boundary edits, cluster move projection and persistence, room narration, and exit catalogs.
  - `corridor/` owns corridor graph editing and persistence orchestration.
  - `runtime/` owns navigation, location serialization, surface resolution, labels, door/stair/transition catalogs, and runtime state repair.
  - `transition/` owns transition create/place/delete flows and transition target lookup.
  - `support/` owns transaction helpers.
  - Application services orchestrate workflows and transactions; they must not keep a second interpretation of room, corridor, or runtime truth.
- `loading/`
  - `DungeonMapLoader` performs JDBC reads, schema compatibility checks, and layout rehydration.
  - `DungeonMapLoadingService` owns async loading, initial-load deduplication, stale-request suppression via `requestSequence`, and reload-after-write flows.
- `persistence/`
  - Write-side repositories and schema helpers only. Storage writes stay here; feature code must not write SQL anywhere else.
- `catalog/`
  - Map create/rename/delete lives here with feature-local application and persistence code.
- `canvas/`
  - `canvas/base/` owns workspace, camera, pointer events, theme, view mode, render payloads, and scene frame assembly.
  - `canvas/grid/` owns the grid renderer and interactive label drawing.
  - Canvas code renders and captures raw input; it does not decide domain meaning.
- `shell/`
  - `editor/` owns the editor view, controls, state pane, dropdowns, and tool coordinator wiring.
  - `editor/interaction/` owns editor tool implementations plus the tool-resolution pipeline.
  - `interaction/` owns shared hit probing, hit sources, selection objects, placement validation, and drag helpers used by editor and runtime.
  - `runtime/` owns runtime view, runtime interaction controller, and runtime selection policy.
- `state/`
  - Observable cross-class runtime/editor state only. If a transient concern is private to one tool, keep it on the tool.

## Concern Ownership

- Hit collection owns raw candidates. `DungeonSelection` is event-time data only.
- `CellCoord` is the canonical 2D cell primitive at model-owner seams, pointer events, hit probes, drag/placement helpers, runtime navigation, and renderer overlays.
- `DungeonHitProbe` carries canonical `CellCoord` cell context plus canonical `GridPoint2x` probe geometry. Cell hits use `DungeonHitSurface.CellSurface`, while shared half-step hit geometry uses set-based `PointSurface` and `SegmentSurface`.
- `DungeonLayout` owns canonical `CellCoord` lookups, traversable-cell indices, and level-aware cell queries. Corridor room bindings use `CellCoord`; geometry-backed picks and selections use `GridPoint2x` and `GridSegment2x`.
- `DungeonHitSubject` and `DungeonSelectionLookup` expose geometry-backed editor/runtime selections only as `GridPoint2x` and `GridSegment2x`. Do not add raw doubled-cell mirrors or storage-parity mirrors back into those seams.
- `InteractiveLabelHandle`, `DungeonEditorRenderState`, and `DungeonRuntimeRenderOverlay` are display payloads on final `CellCoord`/`GridPoint2x`/`GridSegment2x` only. Keep persisted odd/odd translation at the storage seam, never in renderers or tools.
- `EditorTool.resolveHit(...)` owns tool-specific interpretation of those candidates. Do not move per-tool allowlists back into a central selector.
- `EditorInteractionState` owns only shared editor coordination state:
  - `selectedKey`
  - `hovered` as `EditorHover`
  - `activePreview`
  - `activeDraft`
- `EditorHover` is explicit render intent: `EditorHoverScope.OWNER` highlights the owning target, `PART` highlights the concrete part. Hover is not just "the current selection key".
- `DungeonMapState` owns loaded map/catalog data, projection level, overlay settings, loading flags, and mutation-pending state.
- `DungeonRuntimeState` owns persisted location, drag preview location, heading, and loading/moving error flags.
- Preview is never commit state. Reload is the authoritative rebuild after a successful write, not a repair step for partial semantics.

## Editor Interaction

- `DungeonEditorSelectionPolicy` only gates raw input phases. It must not encode tool semantics.
- `EditorInteraction` runs the canonical editor pipeline:
  1. collect `DungeonHitSnapshot`
  2. build `DungeonSelection`
  3. ask the active tool to `resolveHit(...)`
  4. store hover from `EditorHitResolution`
  5. dispatch `pressed`, `dragged`, or `released` with an `EditorToolContext` that carries the resolved subject
- `EditorTool` implementations own gesture meaning. Shared state is justified only when multiple collaborators need it.
- Tool responsibilities:
- `SelectionTool` owns semantic selection plus cluster-drag and corridor-node drag gestures.
- `PaintTool` owns room paint/delete sessions from resolved `FloorCellSubject` hits.
- `BoundaryTool` owns wall-path drafting. Shared state exposes only boundary preview and lightweight status; the shared preview payload is 2x render geometry, not commit truth.
- `ConnectionsTool` owns door edits, corridor drafting, node insertion, and corridor deletion. Corridor graph edits use explicit 2x node/segment points.
  - `TransitionTool` owns transition create/delete gestures and keeps its form state local to the tool.
- `DungeonSelection.firstSubjectMatching(...)` and `orderedSubjects()` are the shared helpers for per-tool subject resolution. Prefer these over ad-hoc candidate walks.
- Selection identity is semantic. Use owner-provided keys (`DungeonSelectionKey`, label handles, structure ids) instead of reconstructing or parsing them in renderers.

## Workspace And Rendering

- `DungeonCanvasWorkspace` observes `DungeonMapState` directly for active layout, level, and overlay changes.
- Rendering is explicit and coalesced: state changes call `requestRedraw()`, `redraw()` builds one `DungeonSceneFrame`, and the grid renderer consumes that snapshot.
- Views publish batched display-only payloads through `showEditorRenderState(...)` and `showRuntimeRenderOverlay(...)`.
- `DungeonGridSceneRenderer` renders room and corridor floors from `CellCoord` surfaces and boundaries/overlays from final `GridPoint2x`/`GridSegment2x` carried by `StructureObject`, editor previews, and runtime overlays. Do not add renderer-local legacy parity adapters.
- Corridor graph handles are the editor-only overlay on top of that shared structure geometry.
- The workspace owns zoom, pan, and default level scrolling:
  - zoom: mouse wheel
  - pan: middle-mouse drag
  - level change: Ctrl+scroll or interaction-captured scroll, then `levelScrolled(int)` is sent to the active interaction handler
- Runtime may replace the default level-scroll handler to clamp to reachable levels.
- `DungeonEditorRenderState` is display-only. It carries selected target key, explicit hover state, and previews, including 2x boundary preview segments/points. Do not put workflow state into render payloads.

## Runtime

- `DungeonRuntimeInteractionController` owns drag-to-move. Press starts only when the active cell is selected; drag shows preview; release commits a move.
- `DungeonRuntimeSelectionPolicy` selects the first runtime-selectable subject that actually owns the active cell. Runtime interaction is not driven by the primary hit candidate alone.
- `DungeonRuntimeView` keeps runtime presentation on `DungeonRuntimeLocation.Cell` plus projection level and calls `DungeonRuntimeSurfaceResolver.resolve(layout, activeCell, levelZ, heading)` directly.
- `DungeonRuntimeSurfaceResolver` must read from direct structure owners and build one `DungeonRuntimeSurface`; room/corridor/cell/stair/transition presentation all funnel through that one surface model.
- Runtime details are published through the shared `DetailsNavigator`. Do not add a parallel feature-local runtime details pane.
- Same-map transition travel should return a resolved navigation snapshot against the current layout immediately; cross-map travel returns a snapshot for the target map and the view triggers a reload.

## Model Layering

`model/` follows this dependency direction:

`geometry/ -> interaction/ + objects/ -> structures/ -> DungeonLayout`

- `geometry/` owns reusable math with no dungeon semantics.
- `interaction/` owns model-side interaction descriptors that other layers may consume but not reinterpret.
- `objects/` are thin domain objects over geometry.
- `structures/` own dungeon semantics and structure-local behavior.
- `DungeonLayout` indexes and exposes structure relationships, traversable cells, level projections, connections, stairs, transitions, and lookups. It must not become a second home for structure-specific edit semantics.

### Key structure rules

- `Room` owns room-local truth and narration.
- `RoomCluster` owns multi-room rewrite logic, grouping, adjacency, and cluster moves. Its aggregate cells stay on `CellCoord`, and its internal boundary edits/metadata use final `GridSegment2x`, both derived from room-owned `StructureObject`s.
- `Connection` owns connectivity; `Door` is the boundary object exposed through that connection.
- `Corridor` is a first-class structure with stable identity, nodes, segments, room bindings, and derived geometry. In memory it owns final `GridPoint2x`/`GridSegment2x` path truth plus `CellCoord` room bindings; `DungeonMapLoader` and `DungeonCorridorWriteRepository` translate the persisted legacy `grid_x2/grid_y2` coding at the storage seam.
- `DungeonStair` is a first-class structure with stable identity and explicit 3D path geometry. Exits are derived views, not persisted second truths.
- `DungeonTransition` owns transition identity, placement anchor, destination, and optional bidirectional link. Unplaced transitions are valid; spatial queries must guard for null anchor or placement state.

## Loading And Persistence

- `DungeonMapLoader` is the only authoritative rehydration path. It loads catalog entries, reconstructs layouts from direct structure tables, skips unusable maps, and falls back to the first usable map when necessary.
- Room geometry is loaded directly from persisted room-owned `StructureDescriptor` rows.
- Storage model:
  - clusters: membership owner plus derived `center_x`, `center_y`, `level_z` metadata only
  - rooms: `dungeon_rooms` row plus per-level descriptor tables `dungeon_room_levels`, `dungeon_room_level_seeds`, and `dungeon_room_level_segments`
  - corridors: stable corridor identity plus node/segment tables
  - stairs: stable stair identity plus ordered 3D path nodes
  - transitions: `dungeon_transitions` with nullable placement coordinates and destination discriminator
- A room must have persisted descriptor rows. Maps with missing room descriptors are rejected during load.
- Write flows should persist in one transaction and then reload through `DungeonMapLoadingService.submitReloadingWrite(...)` or `submitReloadingTask(...)`.

## Guardrails

- Document only code that exists now. If a directory is empty, treat it as unused, not as permission to spread new responsibilities there.
- Prefer one clear owner over parallel preview/commit/reload interpretations of the same concern.
- If a workflow can only be explained by "reload will sort it out", the ownership boundary is wrong.
- Update this file only when the architecture actually changes. It is guidance, not a changelog.
