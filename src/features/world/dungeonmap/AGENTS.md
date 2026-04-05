# AGENTS.md

This file covers `src/features/world/dungeonmap/`. Use it together with the root `AGENTS.md`; root rules still apply unless this file narrows them for the dungeon feature.

## Scope

`dungeonmap` is a tile-grid dungeon editor and runtime surface inside Salt Marcher. Empty directories do not define architecture or ownership.

## Composition Root

- `bootstrap/DungeonMapModule` is the only feature composition root. It wires one shared `DungeonMapState`, `DungeonEditorSessionState`, `EditorInteractionState`, `DungeonHitCollector`, loading services, one `DungeonRoomApplicationService`, corridor/transition application services, and exposes `DungeonRuntimeView` plus `DungeonEditorView`.
- Both views extend `shell/AbstractDungeonMapView`. That base class owns the view-local `DungeonCanvasWorkspace` and calls `DungeonMapLoadingService.ensureLoaded()` from `onShow()`.
- `DungeonViewMode` currently exposes the `GRID` projection. Additional modes must preserve the same direct-owner semantics across editor, runtime, and documentation.

## Current Architecture

- `CellCoord`, `GridPoint2x`, and `GridSegment2x` are the only canonical 2D primitives. Persisted x2 columns store the same canonical raw coordinates used in memory; do not reintroduce an offset codec at JDBC seams.
- `DungeonLayout` is the immutable global lookup over direct structure owners: room clusters, corridors, stairs, transitions, connections, traversable cells, and spatial indexes.
- Corridors, stairs, and transitions are first-class persisted structures. There is no second aggregate that owns their geometry.
- `Room` and `Corridor` expose shared surface geometry only through `StructureObject`.
- `Corridor` keeps its node/segment graph as truth, stores node and route geometry directly as final `GridPoint2x`/`GridSegment2x`, keeps room-bound endpoints on absolute `CellCoord` room cells in memory, and compiles that graph into the same `StructureDescriptor`/`StructureObject` surface model used by rooms, including opening segments for room-bound endpoints. Junction nodes are explicit authored state: door-to-corridor attachments and tile-drags may create them, but routing itself must not invent extra nodes.
- Room paint/delete/boundary edits persist room-owned `StructureDescriptor` truth plus derived cluster metadata. They do not reroute or regenerate corridors or stairs.
- Connection doors and room exit narration are level-aware. Shared boundary/door queries must keep `levelZ` together with the 2x segment instead of collapsing identical segments across floors.
- `Wall` and `Door` are 2x-native boundary objects keyed by normalized `GridSegment2x` collections. Do not reintroduce vertex-edge wrapper geometry in productive wall/door flows.
- Tile-owned surfaces are owned as explicit `CellCoord` sets on `Floor` and other cell-surface seams. Do not reintroduce a second tile-area wrapper type just to shuttle those cells between owners.
- `StructureDescriptor.LevelDescriptor` authors room/corridor surface truth as `anchorCell`, `fillSeeds`, `boundaryEdges`, and `openingEdges`; rooms may additionally persist an explicit per-level `floorCells` subset inside that authored surface. `StructureObject` exposes both surfaces directly via `cellCoordsAtLevel(...)` and `floorCellCoordsAtLevel(...)` without reconstructing removed legacy tile wrappers.
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
  - `room/` owns room topology, boundary edits, local door moves, cluster moves, and room narration through the central `DungeonRoomApplicationService` workflow seam.
  - `corridor/` owns corridor graph workflow orchestration for door-to-door create, door-to-boundary attach, corridor-door moves, tile-node promotion, node move, and local delete/split, while canonical graph transforms stay on `Corridor` and persistence-specific id assignment stays on `DungeonCorridorRepository`.
  - `stair/` owns stair create/update/delete/move flows plus reopen metadata loading. It validates room-floor anchors, authored stop levels, and generates the canonical ordered stair path from editor inputs without moving that generation policy into `DungeonStairRepository`. Preview and commit must share that stair-draft resolution logic instead of mirroring it in editor tools.
  - `runtime/` owns cell-only navigation, TILE persistence, runtime description resolution, description refs/exits, flat runtime actions, and runtime state repair.
  - `transition/` owns transition create/place/delete flows plus transition target lookup through one `DungeonTransitionApplicationService`. Door- and stair-shaped transition placement reuse the shared boundary and stair-draft authoring seams instead of keeping transition-only geometry rules. Do not split read options into a second application owner.
  - `support/` owns transaction helpers.
  - Application services orchestrate workflows and transactions; they must not keep a second interpretation of room, corridor, or runtime truth.
- `loading/`
  - `DungeonMapLoadResolver` owns synchronous catalog scans, usable-map selection, selected-map fallback, and runtime-repair fallback order.
  - `DungeonMapLoadResolver` must resolve preferred fallback IDs against the fresh catalog instead of reusing stale `DungeonMapCatalogEntry` objects from `DungeonMapState`.
  - `DungeonMapLoadingService` owns async loading, initial-load deduplication, stale-request suppression via `requestSequence`, and reload-after-write flows around that resolver.
  - Loading resolution helpers stay nested inside the loading owner; views and state consume only `DungeonMapState`.
- `repository/`
  - `DungeonLayoutRepository` is the authoritative layout rehydration seam. It assembles one concrete persisted map per call and does not own UI-facing fallback policy.
  - Structure repositories (`DungeonRoomRepository`, `DungeonCorridorRepository`, `DungeonStairRepository`, `DungeonTransitionRepository`) own their direct storage reads and writes.
  - `DungeonStorageSupport` owns current dungeon schema DDL only. `DatabaseManager.setupDatabase()` creates it once at startup; feature reads and writes do not run schema or compatibility checks.
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
  - `runtime/` owns runtime view, runtime interaction controller, runtime selection policy, and runtime-specific surface panes.
- `state/`
  - Observable cross-class runtime/editor state only. If a transient concern is private to one tool, keep it on the tool.
  - Session enums such as `DungeonViewMode` and `DungeonEditorTool` belong here when `DungeonEditorSessionState` is the shared owner.

## Concern Ownership

- Hit collection owns raw candidates. `DungeonHitSnapshot` is the shared event-time selection surface.
- `CellCoord` is the canonical 2D cell primitive at model-owner seams, pointer events, hit probes, drag/placement helpers, runtime navigation, and renderer overlays.
- `DungeonHitProbe` carries canonical `CellCoord` cell context plus canonical `GridPoint2x` probe geometry. Cell hits use `DungeonHitSurface.CellSurface`, while shared half-step hit geometry uses set-based `PointSurface` and `SegmentSurface`.
- `DungeonLayout` owns canonical `CellCoord` lookups, traversable-cell indices, and level-aware cell queries. Corridor room bindings use `CellCoord`; geometry-backed picks and selections use `GridPoint2x` and `GridSegment2x`.
- `DungeonSelectionRef` is the shared hit/hover/selection seam. It exposes geometry-backed editor/runtime selections only as canonical ids plus final `GridPoint2x`, `GridSegment2x`, and `CubePoint`. Do not add raw doubled-cell mirrors or storage-parity mirrors back into that seam.
- Internal wall hits should resolve through `RoomBoundaryRef` only. Tools that need cluster context on those walls must derive it from `DungeonLayout.describeRoomBoundary(...)` instead of reintroducing parallel cluster-boundary hit refs.
- Free corridor wall hits should resolve through `CorridorBoundaryRef` only. Tools that need corridor-cell context on those walls must derive it from `DungeonLayout.describeCorridorBoundary(...)` instead of rebuilding wall semantics locally.
- `DungeonHitKind` and `DungeonSelectionRef` are shared interaction semantics owned by `model/interaction/`, not by `shell/interaction/`.
- `DungeonSelectionRef.ownerRef()` owns typed owner semantics. Do not mirror owner resolution back into shell-local wrapper hierarchies or generic nullable owner-id helper channels.
- `DungeonSelectionHighlightResolver` is the shared `DungeonSelectionRef -> DungeonHitSurface` seam for editor hover/highlight rendering. Keep that geometry translation out of `DungeonGridSceneRenderer` and out of tool code.
- `InteractiveLabelHandle` and `DungeonEditorRenderState` are display payloads on final `CellCoord`/`GridPoint2x`/`GridSegment2x` only. `DungeonRuntimeRenderOverlay` carries the active `DungeonRuntimeNavigationSnapshot` plus runtime exit markers derived from the resolved runtime description. Renderers and tools must not introduce storage codecs or legacy parity adapters.
- `EditorTool.interactionCapabilities(...)` owns tool-specific interpretation of those candidates. `EditorInteraction` executes those ordered capabilities, but the tool remains the owner of what counts as interactive.
- `EditorInteractionState` owns only shared editor coordination state:
  - `selectedRef`
  - `hovered` as `EditorHover`
  - `activePreview`
- `DungeonEditorSessionState` owns the shared selected tool and active view mode. Do not make it depend on shell- or canvas-owned enums.
- `EditorHover` is explicit render intent: `EditorHoverScope.OWNER` highlights the owning target, `PART` highlights the concrete part. Hover is not just "the current selection ref".
- `DungeonMapState` owns loaded map/catalog data, projection level, overlay settings, loading flags, and mutation-pending state.
- `DungeonRuntimeState` owns persisted, preview, and pending `DungeonRuntimeNavigationSnapshot`s plus loading/dragging/moving and error flags. Runtime callers should move snapshot truth through that state instead of threading loose cell/level/heading tuples.
- Preview is never commit state. Reload is the authoritative rebuild after a successful write, not a repair step for partial semantics.

## Editor Interaction

- `EditorInteraction` runs the canonical editor pipeline:
  1. collect `DungeonHitSnapshot`
  2. ask the active tool for ordered `interactionCapabilities(...)`
  3. execute the first matching capability into `EditorHitResolution`
  4. store hover from that resolved capability
  5. dispatch `pressed`, `dragged`, or `released` with an `EditorToolContext` that carries the resolved hit ref and selection ref
- `EditorTool` implementations own gesture meaning. Shared state is justified only when multiple collaborators need it.
- Tool responsibilities:
- `SelectionTool` owns semantic selection plus cluster-drag, whole-stair drag, door-drag, and corridor-node drag gestures. Selecting a stair through that tool must surface the same stair editor state that `ConnectionsTool` uses, and stair drag preview/commit must move the full stair anchor/span/stop set together instead of inventing a second stair-move interpretation in shell code. Dragging a plain corridor tile first promotes that tile to an explicit node and then hands the drag to that new node; dragging a connection door reuses `ConnectionRef` as the source and `RoomBoundaryRef` as the drop target, and a simple click on a corridor tile must not create state.
- `RoomNarrationPane` owns the room narration editor UI for the current selection; `SelectionTool` no longer embeds that form logic.
- `PaintTool` owns room paint/delete sessions from resolved `GridCellRef` hits and publishes paint previews as `CellCoord` sets, not hydrierten room structures.
- `FloorTool` owns floor paint/delete sessions inside existing room surface. It reuses the shared rectangular drag-window helper with `PaintTool`, but filters the preview/commit set back down to valid room cells on the active level.
- `BoundaryTool` owns wall-path drafting. In delete mode it may remove local door segments as part of one internal barrier path; draft state stays local to the tool and shared state exposes only boundary preview geometry.
- `ConnectionsTool` owns door edits plus the surface-driven corridor/stair authoring flow: `room exterior wall <-> room exterior wall` creates a fresh corridor, `room exterior wall <-> free corridor wall` attaches another room to an existing corridor, interior editable room walls create local doors, and room-floor clicks start stair drafts while stair clicks reopen existing authored specs. Delete mode removes corridor segments, explicit nodes, corridor-bound doors, and whole stairs. It may own stair form parsing and preview UX, but shared stair-draft validation/path resolution must stay in `application/stair/`. It must not restore freehand waypoint drafting or corner-insert gestures.
- `TransitionTool` owns transition create/delete gestures and keeps its form state local to the tool. It should carry selected destinations directly as `DungeonTransitionDestination` plus a small local mode hint, not as parallel target-id fields that are rebuilt into destinations later.
- `DungeonHitSnapshot.firstRefMatching(...)` and `orderedRefs()` are the shared helpers for per-tool hit resolution. Prefer these over ad-hoc candidate walks.
- Selection identity is semantic. Compare typed owner refs from `DungeonSelectionRef` instead of reconstructing owners through generic ids or parsing helpers in renderers.

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
- Persisted dungeon runtime positions are `TILE`-only end to end. Do not reintroduce `ROOM`, `CORRIDOR`, `STAIR_EXIT`, `TRANSITION`, or string-encoded tile compatibility shapes at the campaign-state boundary.
- `DungeonRuntimeLocation` is the shared parsed runtime context. Runtime shell wiring should resolve it once per refresh and branch from there instead of reparsing room/corridor/stair/transition ownership per sink.
- `DungeonRuntimeView` is shell wiring over `DungeonRuntimeState`; cross-map continuation lives in the shared pending navigation snapshot instead of a view-local copy, and the view publishes overlay and inspector surfaces from one resolved `DungeonRuntimeDescription` plus travel actions resolved in parallel from the same parsed runtime location.
- `DungeonRuntimeDescriptionResolver` is the only seam that writes a `DungeonRuntimeDescription`. It owns runtime exits and description text only; executable runtime actions belong to `DungeonRuntimeActionResolver`.
- Runtime details are published through the shared `DetailsNavigator`. Do not add a parallel feature-local runtime details pane.
- Same-map transition travel should return a resolved navigation snapshot against the current layout immediately; cross-map travel returns a snapshot for the target map, the loading flow selects that map, and runtime resolves the pending snapshot directly instead of re-reading campaign state first.
- Runtime repair must resolve preferred/first-usable maps through `DungeonMapLoadResolver`, not by reading `DungeonMapCatalogRepository` directly from `application/runtime`.

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
- `RoomCluster` owns multi-room topology, grouping, adjacency, paint/delete/boundary mutation semantics, and cluster moves. Its aggregate cells stay on `CellCoord`, and its internal boundary edits/metadata use final `GridSegment2x`, both derived from room-owned `StructureObject`s.
- `RoomCluster` owns its mutation and boundary-path semantics directly. Do not reintroduce a second public planner/helper type or diff payload that mirrors cluster topology decisions from the outside.
- `RoomCluster` derives `LocalConnection`s from its rooms; final cluster owners must not carry a second local-connection truth in parallel.
- `RoomCluster` owns door editability and local door moves on internal boundaries. Do not leave local door create/delete/move validation only in editor tools.
- `Connection` owns connectivity; `Door` is the boundary object exposed through that connection.
- Model-side exit descriptors and low-level door exit catalogs belong with room/connection truth, not under runtime or room application workflows. Public room/corridor exit-description queries live on `DungeonLayout`, the shared owner of structure lookup plus connection context; do not route runtime/editor callers through a second public room-exit helper owner.
- `Corridor` is a first-class structure with stable identity, nodes, segments, room bindings, and derived geometry. In memory and at persistence seams it owns canonical `GridPoint2x`/`GridSegment2x` path truth plus `CellCoord` room bindings, and it owns its direct graph transforms (`attach`, `move door`, `promote tile`, `move node`, `delete segment`, `delete node`) instead of delegating them to a second public graph-editor helper.
- `DungeonStair` is a first-class structure with stable identity, explicit 3D path geometry, and authored stop levels. Exits are derived views from that path plus stop levels, not persisted second truths.
- `DungeonTransition` owns transition identity, typed placement (`DoorPlacement` or `StairPlacement`), destination, and optional bidirectional link. Unplaced transitions are valid; door placements contribute boundary-backed transition connections while stair placements contribute traversable transition geometry without a same-map stair connection.
- Transition workflows should call `DungeonTransitionApplicationService` directly with either a direct `DungeonTransitionDestination` or a prepared transition id. Do not reintroduce request DTOs or catalog option types that decompose the destination back into enum-and-id fields before writing.

## Loading And Persistence

- `DungeonLayoutRepository` is the authoritative rehydration path for one concrete persisted map. It delegates structure reads to the focused repositories and does not return loading-layer fallback payloads.
- `DungeonRoomApplicationService` is the single room workflow owner. Selection, paint, boundary, movement, narration, and transition placement should all call that seam instead of splitting room writes across parallel services.
- `DungeonRoomRepository` owns the concrete write ordering for replacing original clusters with final cluster owners, plus moved clusters. Application workflows decide the final owners, repository code decides insert/update/delete order.
- `DungeonCorridorRepository` owns corridor row writes, synthetic-to-persistent id assignment, node/segment replacement order, and direct persistence of absolute room-bound endpoint cells. Room-bound corridor endpoints move or detach explicitly in room workflows and previews instead of hiding behind a storage codec.
- `DungeonStairRepository` owns stair row writes, ordered path-node persistence, authored stop-level persistence, and editor reopen metadata columns. It does not infer exits from room/corridor occupancy and it does not become a second owner of stair generation rules.
- Room rewrite workflows must validate and rebind affected room-bound corridor endpoints from their stable `roomCell` + exterior boundary before commit. Split/merge operations must never leave a persisted corridor node pointing at a stale `roomId`; if the same boundary no longer resolves to exactly one exterior room, the room mutation is invalid.
- `DungeonTransitionRepository` owns dungeon-side transition lookups and writes, including placed-target queries and dungeon-map existence checks. Overworld target discovery stays at the `WorldReadApi` boundary, and that public API remains connection-owning instead of leaking JDBC through cross-feature callers.
- `DungeonMapLoadResolver` owns catalog reads, initial-load usable-map scans, selected-map fallback, and runtime-repair map selection. Full-catalog usable-layout scans are for initial load, not every selection change.
- `DungeonMapLoadingService` owns async orchestration and state updates around `DungeonMapLoadResolver`; it must not grow a second copy of the resolver's selection policy.
- Legacy dungeon storage compatibility is intentionally unsupported. Current code works only against the current schema and should fail fast on broken or stale rows instead of normalizing them at runtime.
- Room geometry is loaded directly from persisted room-owned `StructureDescriptor` rows.
- New dungeons start with a neutral default room (`Raum n`), not an implicit entrance concept.
- New stairs created through the editor persist a generated default name (`Treppe n`) when the user leaves the name blank; legacy unnamed stairs keep their fallback labels until explicitly renamed.
- Cluster move previews and persisted cluster moves share the same explicit corridor rewrite rule: horizontal room-bound endpoints move with their rooms and reroute only their adjacent segments, explicit free nodes keep their absolute positions, and level moves detach room bindings in place.
- Storage model:
  - clusters: membership owner plus derived `center_x`, `center_y`, `level_z` metadata only
  - rooms: `dungeon_rooms` row plus per-level descriptor tables `dungeon_room_levels`, `dungeon_room_level_seeds`, and `dungeon_room_level_segments`
  - corridors: stable corridor identity plus node/segment tables
  - stairs: stable stair identity plus ordered 3D path nodes, authored stop levels, and persisted editor reopen metadata for anchor/shape/direction/dimensions
  - transitions: `dungeon_transitions` with a nullable placement discriminator plus either door-boundary placement fields or stair geometry/reopen rows, alongside the destination discriminator
- A room must have persisted descriptor rows. Maps with missing room descriptors are rejected during load.
- Write flows should persist in one transaction and then reload through `DungeonMapLoadingService.submitMutation(...)`; map switches should go through `selectMap(...)`.
- Cluster move previews are built directly from `DungeonLayout.withMovedCluster(...)`; do not reintroduce a second projection wrapper type around the provisional layout.

## Guardrails

- Document only code that exists now. If a directory is empty, treat it as unused, not as permission to spread new responsibilities there.
- Prefer one clear owner over parallel preview/commit/reload interpretations of the same concern.
- If a workflow can only be explained by "reload will sort it out", the ownership boundary is wrong.
- Update this file only when the architecture actually changes. It is guidance, not a changelog.
