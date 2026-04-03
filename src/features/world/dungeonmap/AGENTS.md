# AGENTS.md

This file covers `src/features/world/dungeonmap/`. Use it together with the root `AGENTS.md`; root rules still apply unless this file narrows them for the dungeon feature.

## Scope

`dungeonmap` is a tile-grid dungeon editor and runtime surface inside Salt Marcher. Empty directories do not define architecture or ownership.

## Composition Root

- `bootstrap/DungeonMapModule` is the only feature composition root. It wires one shared `DungeonMapState`, `DungeonEditorSessionState`, `EditorInteractionState`, `DungeonHitCollector`, loading services, edit services, and exposes `DungeonRuntimeView` plus `DungeonEditorView`.
- Both views extend `shell/AbstractDungeonMapView`. That base class owns the view-local `DungeonCanvasWorkspace` and calls `DungeonMapLoadingService.ensureLoaded()` from `onShow()`.
- `DungeonViewMode` currently exposes the `GRID` projection. Additional modes must preserve the same direct-owner semantics across editor, runtime, and documentation.

## Current Architecture

- `CellCoord`, `GridPoint2x`, and `GridSegment2x` are the only canonical 2D primitives. Persisted x2 columns store the same canonical raw coordinates used in memory; do not reintroduce an offset codec at JDBC seams.
- `DungeonLayout` is the immutable global lookup over direct structure owners: room clusters, corridors, stairs, transitions, connections, traversable cells, and spatial indexes.
- Corridors, stairs, and transitions are first-class persisted structures. There is no second aggregate that owns their geometry.
- `Room` and `Corridor` expose shared surface geometry only through `StructureObject`.
- `Corridor` keeps its node/segment graph as truth, stores node and route geometry directly as final `GridPoint2x`/`GridSegment2x`, and compiles it into the same `StructureDescriptor`/`StructureObject` surface model used by rooms, including opening segments for room-bound endpoints.
- Room paint/delete/boundary edits persist room-owned `StructureDescriptor` truth plus derived cluster metadata. They do not reroute or regenerate corridors or stairs.
- Connection doors and room exit narration are level-aware. Shared boundary/door queries must keep `levelZ` together with the 2x segment instead of collapsing identical segments across floors.
- `Wall` and `Door` are 2x-native boundary objects keyed by normalized `GridSegment2x` collections. Do not reintroduce vertex-edge wrapper geometry in productive wall/door flows.
- Tile-owned surfaces are owned as explicit `CellCoord` sets on `Floor` and other cell-surface seams. Do not reintroduce a second tile-area wrapper type just to shuttle those cells between owners.
- `StructureDescriptor.LevelDescriptor` authors room/corridor floor truth as `anchorCell`, `fillSeeds`, `boundaryEdges`, and `openingEdges`, with room/cluster descriptors carrying canonical `GridSegment2x` boundary edges in memory. `StructureObject` hydrates floors, walls, and doors from that cell/edge truth without reconstructing removed legacy tile wrappers.
- Room/cluster persistence keeps the existing `anchor_x2`/`seed_x2` column names, but their values are canonical raw 2x coordinates for `CellCoord` and `GridSegment2x`, not a shifted legacy parity scheme.
- Interactive labels, editor boundary previews, and runtime door-number overlays anchor directly on final `GridPoint2x`/`GridSegment2x`. Canvas and hit-probe `+1/-1` projection math maps canonical raw 2x coordinates into pixel space and must not be conflated with storage compatibility.
- Runtime presentation resolves surfaces from the same structure owners used by the editor. Do not invent runtime-only structure mirrors.

## Package Roles

- `model/`
- `geometry/` owns pure grid math and routing primitives.
- `geometry/` keeps canonical cell-space on `CellCoord` and the final doubled-grid contract on `GridPoint2x`/`GridSegment2x`. Do not add secondary tile-area wrappers or old-parity bridge types as competing geometry owners.
  - `interaction/` owns model-side interaction seams such as `InteractiveLabelHandle`, `DungeonHitKind`, and `DungeonSelectionRef`; semantic label and selection identity live here, not in canvas or shell code.
- `objects/` owns thin domain objects over geometry such as `Floor`, `Wall`, `Door`, `StructureObject`, and `StructureDescriptor`. `Wall`/`Door` stay segment-based; shared boundary queries operate on `GridSegment2x`.
  - `structures/` owns first-class structures and the structure-specific subpackages `cluster`, `connection`, `corridor`, `room`, `stair`, and `transition`.
  - `DungeonLayout` stays the feature-wide lookup surface, not a second mutation owner.
- `application/`
  - `room/` owns room topology, boundary edits, cluster moves, room narration, and exit catalogs.
  - `corridor/` owns corridor graph editing and persistence orchestration.
  - `runtime/` owns cell-only navigation, TILE persistence, surface resolution, labels, flat runtime actions, and runtime state repair.
  - `transition/` owns transition create/place/delete flows and transition target lookup.
  - `support/` owns transaction helpers.
  - Application services orchestrate workflows and transactions; they must not keep a second interpretation of room, corridor, or runtime truth.
- `loading/`
  - `DungeonMapLoadingService` owns async loading, map-selection fallback policy, initial-load deduplication, stale-request suppression via `requestSequence`, and reload-after-write flows.
  - Loading result helpers stay private to `DungeonMapLoadingService`; views and state consume only `DungeonMapState`.
- `repository/`
  - `DungeonLayoutRepository` is the authoritative layout rehydration seam. It assembles one concrete persisted map per call and does not own UI-facing fallback policy.
  - Structure repositories (`DungeonRoomRepository`, `DungeonCorridorRepository`, `DungeonStairRepository`, `DungeonTransitionRepository`) own their direct storage reads and writes.
  - `DungeonStorageSupport` owns dungeon schema readiness and one-time geometry compatibility migration.
- `catalog/`
  - Map create/rename/delete lives here with feature-local application and persistence code.
  - `DungeonMapCatalogEntry` is the shared catalog summary. Loading, state, and shell may consume it, but catalog owns the type.
- `canvas/`
  - `canvas/base/` owns workspace, camera, pointer events, theme, view mode, render payloads, and scene frame assembly.
  - `canvas/grid/` owns the grid renderer and interactive label drawing.
  - Canvas code renders and captures raw input; it does not decide domain meaning.
- `shell/`
  - `editor/` owns the editor view, controls, state pane, dropdowns, and tool coordinator wiring.
  - `editor/interaction/` owns editor tool implementations plus the tool-resolution pipeline.
  - `interaction/` owns shared hit probing, hit sources, hit snapshots, placement validation, and drag helpers used by editor and runtime.
  - `runtime/` owns runtime view, runtime interaction controller, and runtime selection policy.
- `state/`
  - Observable cross-class runtime/editor state only. If a transient concern is private to one tool, keep it on the tool.
  - Session enums such as `DungeonViewMode` and `DungeonEditorTool` belong here when `DungeonEditorSessionState` is the shared owner.

## Concern Ownership

- Hit collection owns raw candidates. `DungeonHitSnapshot` is the shared event-time selection surface.
- `CellCoord` is the canonical 2D cell primitive at model-owner seams, pointer events, hit probes, drag/placement helpers, runtime navigation, and renderer overlays.
- `DungeonHitProbe` carries canonical `CellCoord` cell context plus canonical `GridPoint2x` probe geometry. Cell hits use `DungeonHitSurface.CellSurface`, while shared half-step hit geometry uses set-based `PointSurface` and `SegmentSurface`.
- `DungeonLayout` owns canonical `CellCoord` lookups, traversable-cell indices, and level-aware cell queries. Corridor room bindings use `CellCoord`; geometry-backed picks and selections use `GridPoint2x` and `GridSegment2x`.
- `DungeonHitSubject` and `DungeonSelectionRef` expose geometry-backed editor/runtime selections only as canonical ids plus final `GridPoint2x`, `GridSegment2x`, and `CubePoint`. Do not add raw doubled-cell mirrors or storage-parity mirrors back into those seams.
- `DungeonHitKind` and `DungeonSelectionRef` are shared interaction semantics owned by `model/interaction/`, not by `shell/interaction/`.
- `InteractiveLabelHandle`, `DungeonEditorRenderState`, and `DungeonRuntimeRenderOverlay` are display payloads on final `CellCoord`/`GridPoint2x`/`GridSegment2x` only. Renderers and tools must not introduce storage codecs or legacy parity adapters.
- `EditorTool.resolveHit(...)` owns tool-specific interpretation of those candidates. Do not move per-tool allowlists back into a central selector.
- `EditorInteractionState` owns only shared editor coordination state:
  - `selectedRef`
  - `hovered` as `EditorHover`
  - `activePreview`
- `DungeonEditorSessionState` owns the shared selected tool and active view mode. Do not make it depend on shell- or canvas-owned enums.
- `EditorHover` is explicit render intent: `EditorHoverScope.OWNER` highlights the owning target, `PART` highlights the concrete part. Hover is not just "the current selection ref".
- `DungeonMapState` owns loaded map/catalog data, projection level, overlay settings, loading flags, and mutation-pending state.
- `DungeonRuntimeState` owns persisted cell, drag-preview cell, active level, heading, and loading/moving error flags.
- Preview is never commit state. Reload is the authoritative rebuild after a successful write, not a repair step for partial semantics.

## Editor Interaction

- `EditorInteraction` runs the canonical editor pipeline:
  1. collect `DungeonHitSnapshot`
  2. ask the active tool to `resolveHit(...)`
  3. store hover from `EditorHitResolution`
  4. dispatch `pressed`, `dragged`, or `released` with an `EditorToolContext` that carries the resolved subject and ref
- `EditorTool` implementations own gesture meaning. Shared state is justified only when multiple collaborators need it.
- Tool responsibilities:
- `SelectionTool` owns semantic selection plus cluster-drag and corridor-node drag gestures.
- `RoomNarrationPane` owns the room narration editor UI for the current selection; `SelectionTool` no longer embeds that form logic.
- `PaintTool` owns room paint/delete sessions from resolved `FloorCellSubject` hits and publishes paint previews as `CellCoord` sets, not hydrierten room structures.
- `BoundaryTool` owns wall-path drafting. Draft state stays local to the tool; shared state exposes only boundary preview geometry.
- `ConnectionsTool` owns door edits, corridor drafting, node insertion, and corridor deletion. Corridor graph edits use explicit 2x node/segment points.
  - `TransitionTool` owns transition create/delete gestures and keeps its form state local to the tool.
- `DungeonHitSnapshot.firstSubjectMatching(...)` and `orderedSubjects()` are the shared helpers for per-tool subject resolution. Prefer these over ad-hoc candidate walks.
- Selection identity is semantic. Use owner-provided refs (`DungeonSelectionRef`, label handles, structure ids plus geometry) instead of reconstructing or parsing them in renderers.

## Workspace And Rendering

- `DungeonCanvasWorkspace` observes `DungeonMapState` directly for active layout, level, and overlay changes.
- Rendering is explicit and coalesced: state changes call `requestRedraw()`, `redraw()` builds one `DungeonSceneFrame`, and the grid renderer consumes that snapshot.
- Views publish batched display-only payloads through `showEditorRenderState(...)` and `showRuntimeRenderOverlay(...)`.
- `DungeonGridSceneRenderer` renders room and corridor floors from `CellCoord` surfaces and boundaries/overlays from final `GridPoint2x`/`GridSegment2x` carried by `StructureObject`, editor previews, and runtime overlays. Do not add renderer-local legacy parity adapters.
- Paint previews are direct `CellCoord` overlays. Do not rebuild a temporary `StructureObject` just to render painted tiles.
- Corridor graph handles are the editor-only overlay on top of that shared structure geometry.
- The workspace owns zoom, pan, and default level scrolling:
  - zoom: mouse wheel
  - pan: middle-mouse drag
  - level change: Ctrl+scroll or interaction-captured scroll, then `levelScrolled(int)` is sent to the active interaction handler
- Runtime may replace the default level-scroll handler to clamp to reachable levels.
- `DungeonEditorRenderState` is display-only. It carries selected ref, explicit hover state, and previews, including 2x boundary preview segments/points. Do not put workflow state into render payloads.

## Runtime

- `DungeonRuntimeInteractionController` owns drag-to-move. Press starts only when the active cell is selected; drag shows preview; release commits a move.
- `DungeonRuntimeSelectionPolicy` selects the first runtime-selectable subject that actually owns the active cell. Runtime interaction is not driven by the primary hit candidate alone.
- `DungeonRuntimeApplicationService` is the single runtime workflow owner. It loads persisted navigation, resolves cells against the active layout, executes cell/action travel, persists campaign position as `TILE`, and repairs stored runtime state after catalog mutations.
- Persisted dungeon runtime positions are `TILE`-only. Stored `ROOM`, `CORRIDOR`, `STAIR_EXIT`, and `TRANSITION` compatibility values are not runtime truth; they fall back to the layout default room/traversable cell and get rewritten as `TILE`.
- `DungeonRuntimeView` keeps runtime presentation on active `CellCoord` plus projection level and calls `DungeonRuntimeSurfaceResolver.resolve(layout, activeCell, levelZ, heading)` directly.
- `DungeonRuntimeSurfaceResolver` is the only seam that expands a runtime surface into door overlays plus flat door/stair/transition actions. Do not re-split that public surface into parallel catalogs.
- Runtime details are published through the shared `DetailsNavigator`. Do not add a parallel feature-local runtime details pane.
- Same-map transition travel should return a resolved navigation snapshot against the current layout immediately; cross-map travel returns a snapshot for the target map, the view loads that map, and then applies the pending snapshot directly instead of re-reading campaign state first.

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
- `RoomCluster` owns its rewrite and boundary-path semantics directly. Do not reintroduce a second public planner/helper type that mirrors cluster topology decisions from the outside.
- `RoomCluster` derives `LocalConnection`s from its rooms; rewrite payloads must not carry a second local-connection truth in parallel.
- `Connection` owns connectivity; `Door` is the boundary object exposed through that connection.
- `Corridor` is a first-class structure with stable identity, nodes, segments, room bindings, and derived geometry. In memory and at persistence seams it owns canonical `GridPoint2x`/`GridSegment2x` path truth plus `CellCoord` room bindings; compatibility with the removed shifted storage format lives only in the one-time schema migration.
- `DungeonStair` is a first-class structure with stable identity and explicit 3D path geometry. Exits are derived views, not persisted second truths.
- `DungeonTransition` owns transition identity, placement anchor, destination, and optional bidirectional link. Unplaced transitions are valid; spatial queries must guard for null anchor or placement state.

## Loading And Persistence

- `DungeonLayoutRepository` is the authoritative rehydration path for one concrete persisted map. It delegates structure reads to the focused repositories and does not return loading-layer fallback payloads.
- `DungeonRoomRepository` owns the concrete write ordering for cluster rewrites and moved clusters. Application workflows decide the rewrite, repository code decides insert/update/delete order.
- `DungeonMapLoadingService` owns catalog reads, initial-load usable-map scans, and selected-map fallback. Full-catalog usable-layout scans are for initial load, not every selection change.
- `DungeonStorageSupport.ensureReady(...)` is the single schema-compatibility gate for dungeon startup, feature reads, and writes. Do not reintroduce per-structure schema helpers.
- Room geometry is loaded directly from persisted room-owned `StructureDescriptor` rows.
- Storage model:
  - clusters: membership owner plus derived `center_x`, `center_y`, `level_z` metadata only
  - rooms: `dungeon_rooms` row plus per-level descriptor tables `dungeon_room_levels`, `dungeon_room_level_seeds`, and `dungeon_room_level_segments`
  - corridors: stable corridor identity plus node/segment tables
  - stairs: stable stair identity plus ordered 3D path nodes
  - transitions: `dungeon_transitions` with nullable placement coordinates and destination discriminator
- A room must have persisted descriptor rows. Maps with missing room descriptors are rejected during load.
- Write flows should persist in one transaction and then reload through `DungeonMapLoadingService.submitMutation(...)`; map switches should go through `selectMap(...)`.
- Cluster move previews are built directly from `DungeonLayout.withMovedCluster(...)`; do not reintroduce a second projection wrapper type around the provisional layout.

## Guardrails

- Document only code that exists now. If a directory is empty, treat it as unused, not as permission to spread new responsibilities there.
- Prefer one clear owner over parallel preview/commit/reload interpretations of the same concern.
- If a workflow can only be explained by "reload will sort it out", the ownership boundary is wrong.
- Update this file only when the architecture actually changes. It is guidance, not a changelog.
