# AGENTS.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Scope

This file covers the `dungeonmap` feature — a tile-grid dungeon editor and runtime viewer within the SaltMarcher app. See the root `AGENTS.md` for build commands, project-wide conventions, and the cockpit shell architecture.

## Feature Architecture

The feature ships two `AppView` implementations: `DungeonEditorView` (EDITOR) and `DungeonRuntimeView` (SESSION). Both extend `AbstractDungeonMapView`, which owns a shared `DungeonCanvasWorkspace` and lazy-loads map data on first `onShow()`.

`DungeonMapModule` (`bootstrap/`) is the composition root — it wires all dependencies and exposes the two views to the app shell.

### Package Roles

- `model/` — immutable domain model in three strict layers (see **Model Layering** below)
- `application/` — stateful edit services that plan and persist topology changes. Organized by domain concern:
  - `application/room/` — room paint topology: `DungeonRoomTopologyService` is the single room topology orchestrator for paint/delete/boundary edits; thin facades may wrap transaction entrypoints but must not re-plan topology outside the model. Exit catalogs: `DoorExitCatalog` groups adjacent connection boundary edges into logical openings via BFS, `RoomExitCatalog` wraps it per-room, `RoomExitDescriptor` carries the result
  - `application/corridor/` — corridor lifecycle: `DungeonCorridorEditService` (CRUD), `DungeonCorridorPersistenceService` (single-corridor and batch persistence), `DungeonCorridorRoomRewriteService` (rewrites corridor room membership after topology changes — merge/delete/split), `DungeonCorridorDetailService`. Batch rewrite (reanchor + replan) lives on `Corridor.rewriteAll()`
  - `application/stair/` — stair lifecycle: `DungeonStairEditService` (create with auto-generated vertical path from exit levels, delete with cascade)
  - `application/transition/` — inter-map transition lifecycle: `DungeonTransitionEditService` (two-phase create: direct or prepared+place-later, bidirectional linking, delete with cascade), `DungeonTransitionEditRequest` (sealed creation parameters), `DungeonTransitionTargetCatalogService` (loads placed transitions on a target map for destination selection → `DungeonTransitionTargetSummary`)
  - `application/runtime/` — runtime navigation subsystem: `DungeonRuntimeNavigationService` (orchestrator: load position, resolve surface, move party), `DungeonRuntimeLocation` (sealed: Room | Corridor | CorridorComponent | Tile | StairExit | Transition), `CardinalDirection` (`model/geometry/`, shared 4-direction type with relative-label logic and persistence code), surface pipeline (`DungeonRuntimeSurfaceResolver` → `DungeonRuntimeSurface` → `DungeonRuntimeSurfacePresenter`), door pipeline (`DungeonRuntimeDoorCatalog` enriches exits with destination labels and narration → `DungeonRuntimeDoorDescriptor` adds heading-relative labels), stair pipeline (`DungeonRuntimeStairCatalog` → `DungeonRuntimeStairDescriptor`: filters exits reachable from current level, excludes active tile), transition pipeline (`DungeonRuntimeTransitionCatalog` → `DungeonRuntimeTransitionDescriptor`: resolves destination labels from overworld/dungeon targets), `DungeonRuntimeLabels` (static label generation), `DungeonRuntimeLocations` (location ↔ persistence serialization), `DungeonRuntimeStateRepairService` (consistency repair)
  - `application/support/` — `DungeonTransactionRunner`
  - Services coordinate between model and persistence but must not reconstruct structure truth that already belongs on `Room`, `RoomCluster`, or `Corridor`
- `loading/` — `DungeonMapLoader` (raw JDBC reads) + `DungeonMapLoadingService` (async loading with sequenced request deduplication via `requestSequence` AtomicLong — stale responses discarded). Loader hydrates rooms from stored cluster topology via BFS flood-fill
- `persistence/` — write-side repositories (`DungeonRoomWriteRepository`, `DungeonRoomGeometryWriteMapper`, `DungeonCorridorWriteRepository`, `DungeonStairWriteRepository`, `DungeonTransitionWriteRepository`). Schema helpers (`DungeonSchemaSupport`, `DungeonTransitionSchemaSupport`) for idempotent table creation. Read-side lives in `loading/`
- `catalog/` — map CRUD (create/rename/delete) with its own `application/` + `persistence/` sub-packages
- `canvas/` — JavaFX Canvas rendering, organized into sub-packages:
  - `canvas/base/` — `DungeonCanvasWorkspace` dispatches to a `DungeonSceneRenderer` based on `DungeonViewMode` (GRID vs GRAPH). All state setters route through `notifyViewChanged()` with equality guard clauses for idempotent change propagation. `DungeonRenderState` carries shared render inputs. `DungeonCanvasCamera` handles pan (right-drag) and zoom (scroll, 0.2–5.0×). `DungeonCanvasInteractionHandler` translates pointer events to `DungeonCanvasPointerEvent` with cell coordinates. `DungeonCanvasTheme` provides drawing constants
  - `canvas/grid/` — `DungeonGridSceneRenderer` (tile-based view: background, grid, room fills/outlines, walls, doors, corridor cells/doors, interactive labels, axes), `DungeonGridInteractiveLabels`
  - `canvas/graph/` — `DungeonGraphSceneRenderer` (node-graph view)
- `shell/` — view and UI coordinator layer:
  - `shell/editor/` — `DungeonEditorView`, `DungeonEditorCoordinator` (central wiring hub: binds controls, tools, interaction controllers, and state listeners with separate listener methods per state concern), `DungeonEditorControls`, `DungeonEditorStatePane`
  - `shell/editor/controls/` — left-panel UI: `MapControls` (map selector/CRUD), `ToolControls` (tool palette), `ViewModeControls` (grid/graph toggle), `ToolFamilyDropdownController`, `GuardState`
  - `shell/editor/interaction/` — event dispatch and per-tool controllers (see **Editor Interaction Model** below). Includes `StairInteractionController` and `TransitionInteractionController` for vertical/inter-map structure tools
  - `shell/controls/` — shared controls: `DungeonLevelOverlayControls` (configures multi-level overlay rendering)
  - `shell/runtime/` — `DungeonRuntimeView` (publishes surfaces to `DetailsNavigator`, wires drag-to-move interaction), `DungeonRuntimeInteractionController` (drag-to-move: press on party tile → drag preview → release commits move)
- `state/` — observable transient state containers with `CopyOnWriteArrayList` listener lists. These are the single source of truth for cross-class coordination:
  - `DungeonMapState` — loaded map data (catalog entries, active `DungeonLayout`, loading/error state)
  - `DungeonEditorSessionState` — current tool + view mode
  - `EditorSelectionState` — selected target key (e.g. `"cluster:123"`, `"corridor:456"`)
  - `EditorLayoutPreviewState` — dragged cluster preview (`DungeonLayout` with translated cluster)
  - `EditorPaintPreviewState` — paint/delete preview shape + mode
  - `DungeonCorridorDraftState` — pending corridor endpoint for two-click creation flow
  - `DungeonStairDraftState` — pending stair exit levels for creation (requires ≥2 levels, duplicate guard)
  - `DungeonTransitionDraftState` — transition creation workflow: destination type, bidirectional flag, target map/transition, prepared transition ID, placement error. `displayStatus()` guides the user through the multi-step flow
  - `DungeonLevelOverlaySettings` — overlay mode (`DungeonLevelOverlayMode`: OFF | NEARBY±range | SELECTED levels), opacity, level range
  - `DungeonRuntimeState` — active location + heading, loading/dragging/moving mode flags, error state

### Quarantine

`features/world/quarantine/dungeonmap/` is retained only as legacy code outside the clean feature. `features/world/dungeonmap/` must not import from `features.world.quarantine.dungeonmap`; migrate any needed behavior into the clean package structure instead of reintroducing cross-package bridges.

### Data Flow

1. `DungeonMapLoadingService.ensureLoaded()` → `CompletableFuture` → `DungeonMapLoader` (JDBC) → `DungeonMapLoadResult`
2. Result delivered to `DungeonMapState.showLoaded()` on FX thread via `Platform.runLater`
3. State listeners fire → `DungeonCanvasWorkspace.setMapModel()` → `notifyViewChanged()` → `redraw()`
4. Edit flow: interaction controller → edit service → topology/corridor services + write repositories persist in one transaction → reload

### Editor Interaction Model

`DungeonEditorTool` enum defines tool modes (SELECT, ROOM_PAINT, ROOM_DELETE, CLUSTER_WALL/DOOR, CORRIDOR_CREATE/DELETE, STAIR_CREATE/DELETE, TRANSITION_CREATE/DELETE). Tools are grouped into `ToolFamily` for the dropdown toolbar. Helper predicates: `isStairTool()`, `isTransitionTool()`. `DungeonEditorSessionState` holds current tool + view mode.

`DungeonEditorGridInteractionController` dispatches events by tool:
- **SELECT** → `ClusterSelectionDragController` — click selects cluster (via `EditorSelectionState`), drag shows translated cluster preview (via `EditorLayoutPreviewState`)
- **ROOM_PAINT / ROOM_DELETE** → `RoomPaintInteractionController` — manages `RoomPaintSession` (startCell, endCell, deleteMode), updates `EditorPaintPreviewState` during drag, calls `DungeonRoomTopologyService.paint()`/`.delete()` on release
- **CORRIDOR_CREATE / CORRIDOR_DELETE** → `CorridorInteractionController` — two-click flow via `DungeonCorridorDraftState` (first click stores pending endpoint, second click finalizes), sealed `CorridorEndpoint` (Room | Corridor)
- **STAIR_CREATE / STAIR_DELETE** → `StairInteractionController` — create requires valid `DungeonStairDraftState` (≥2 exit levels); click places stair with auto-generated vertical path and exits. Delete click-targets stair at cell. Draft state resets on tool exit (except re-entering STAIR_CREATE)
- **TRANSITION_CREATE / TRANSITION_DELETE** → `TransitionInteractionController` — create either places a prepared transition or creates+places atomically from `DungeonTransitionDraftState`. Delete click-targets transition at cell, selects then deletes

Canvas pointer events flow through `DungeonCanvasInteractionHandler` → `handlePressed`/`handleDragged`/`handleReleased` → state update → redraw. Hit testing: `DungeonGridHitTester` returns `DungeonEditorHitTarget` / `DungeonEditorLabelHitTarget` for cluster/room/corridor at canvas point.

### Runtime Navigation Model

`DungeonRuntimeInteractionController` implements drag-to-move: press on the party tile starts a drag, `DungeonRuntimeState.showDragPreview()` renders the preview, release commits the move via `DungeonRuntimeNavigationService.moveToTile()`/`moveThroughDoor()`.

After each move, the runtime view resolves the new location into a presentable surface:

1. `DungeonRuntimeSurfaceResolver` pattern-matches on `DungeonRuntimeLocation` (sealed: Room | Corridor | CorridorComponent | Tile | StairExit | Transition) → builds `DungeonRuntimeSurface` (title, entry key, visual description, door list, stair list, transition list)
2. Door enrichment pipeline: structures expose connection boundaries, `DungeonLayout` owns the canonical door registry (`VertexEdge -> Door`), `DoorExitCatalog` groups adjacent boundary edges into openings, then `DungeonRuntimeDoorCatalog`/`DungeonRuntimeDoorDescriptor` add destination labels, narration, and heading-relative labels
3. Stair enrichment: `DungeonRuntimeStairCatalog` finds stairs with exits on the current level within the surface's cells, builds `DungeonRuntimeStairDescriptor` with destination labels and target locations (excludes exits at the active tile)
4. Transition enrichment: `DungeonRuntimeTransitionCatalog` finds placed transitions at the surface's cells/level, builds `DungeonRuntimeTransitionDescriptor` with destination labels (overworld tile or dungeon map + target transition)
5. `DungeonRuntimeSurfacePresenter` converts the surface into JavaFX nodes → published to `DetailsNavigator`

`DungeonRuntimeLabels` provides all display strings (room names, corridor labels joining connected room names, tile coordinates, heading names, stair/transition structure labels at tiles). `DungeonRuntimeLocations` handles bidirectional conversion between `DungeonRuntimeLocation` and the persisted campaign-state format.

Room/corridor narration is model-owned (`RoomNarration`, `RoomExitNarration`). Surface resolution and label generation are static utilities in `application/runtime/`. Do not introduce a separate runtime details panel — surfaces are published through the shared `DetailsNavigator`.

### Coordinator Wiring (DungeonEditorCoordinator)

The coordinator is the glue layer that connects state, canvas, and interaction controllers:
- `sessionState` changes → `workspace.setViewMode()` (renderer switch)
- `selectionState` changes → `workspace.setSelectedTargetKey()` (highlight re-render)
- `paintPreviewState` changes → `workspace.setPreviewPaintShape()` (paint overlay)
- `layoutPreviewState` changes → `workspace.setPreviewMapModel()` (moved cluster overlay)
- `corridorDraftState` changes → state pane hint update
- `stairDraftState` changes → state pane stair section update
- `transitionDraftState` changes → state pane transition section update

Each state concern has a dedicated listener method — no monolithic refresh.

### Room Topology Edit → Corridor Rewrite Flow

When rooms are painted, deleted, or merged, affected corridors must be reanchored and replanned:

1. `DungeonRoomTopologyService` applies room topology changes directly through `RoomCluster` model operations
2. Detects affected corridors via `DungeonLayout.corridorsAffectedBy(ClusterRewrite)`
3. Creates `CorridorRewriteContext` (before/after `CorridorPlanningInput`, affected corridor IDs, deleted cluster IDs)
4. `Corridor.rewriteAll()` — for each affected corridor:
   - `corridor.reanchoredFor(context)` — re-target waypoint/door bindings to new cluster centers (relative offsets survive cluster movement)
   - `corridor.replannedFor(context)` — recompute corridor path via the corridor planning engine
5. All changes (room topology + corridors) persisted in one transaction

### Corridor Planning Algorithm

Routes corridor cells connecting rooms, respecting waypoints and door placements.

1. Resolve rooms, waypoints, door bindings from `CorridorPlanningInput`
2. Try each room as seed, build network incrementally
3. For each unconnected room, find best connection (exit pair preselection limits pathfinding evaluations from O(n²) to ~10 per room pair)
4. Two-tier candidate scoring: local tier (quick adjacency + path cost filter) → global tier (full network score, top 4 finalists only)
5. Score networks; return cells + doors from best-scoring network

Instrumentation available via `saltmarcher.dungeonmap.corridorplanner.profile` system property.

## Model Layering

`model/` is split into three layers with strict dependency direction:

```
geometry/  →  objects/  →  structures/
```

- **`geometry/`** — Pure grid math primitives: `Point2i`, `CubePoint` (3D grid coordinate), `Tile`, `TileShape`, `VertexEdge`, `VertexPath`, `BoundaryNetwork`, `GridAnchor`, `GridRoute`. Domain-agnostic. No knowledge of walls, doors, rooms.
- **`objects/`** — Thin domain objects over geometry: `Floor`, `Wall`, `Door`, `CorridorPath`. `Door` is the boundary object and runtime/registry carrier for traversal state; connectivity lives on `Connection`, and `CorridorPath` is only the routed structure resolved from corridor bindings.
- **`structures/`** — Self-managed compositions: `Room`, `RoomCluster`, `Corridor`, `CorridorNetwork`, `DungeonStair`, `DungeonTransition`. Compose objects and own structure-level behavior.

`DungeonLayout` is the immutable global lookup layer over structures. Mutations return new instances. Pre-computes corridor networks dynamically via `CorridorNetwork.buildNetworks()`. Key aggregate queries: `corridorsAffectedBy(ClusterRewrite)`, `overlappingClusters(TileShape)`, `corridorPlanningInput()`. Spatial indexes for stairs and transitions: `stairsAtCell(cell, z)`, `stairsAtLevel(z)`, `transitionsAtCell(cell, z)`, `transitionsAtLevel(z)`, `findStair(id)`, `findTransition(id)`. Stair exit positions are included in traversable cells.

### Key Structures

- **`Room`** — record: roomId, mapId, clusterId, name, Floor, Walls, `RoomNarration` (visual description + per-exit `RoomExitNarration` entries). `resolved()` keeps room-owned wall boundaries canonical. Connectivity is queried through layout connections instead of mirrored room-local door state.
- **`RoomCluster`** — groups rooms spatially, manages adjacency via overlap indexing, and owns cluster-local rewrite logic for paint/delete/boundary changes. `movedBy()` handles translation. Produces `InteractiveLabelHandle` for canvas rendering.
- **`Corridor`** — record: corridorId, mapId, roomIds, `CorridorBindings` (canonical relative truth), `CorridorPath` (runtime derived geometry). Bindings store waypoints and door entries as relative offsets from cluster centers → survive cluster movement without re-editing. Mutation methods: `withAddedRoom()`, `mergeWith()`, `reanchoredFor()`, `replannedFor()`.
- **`DungeonStair`** — record: stairId, mapId, name, 3D path (`List<CubePoint>`), exits (`List<DungeonStairExit>`). Represents vertical connections across Z-levels. `DungeonStairExit` is a landing point at a specific `CubePoint`. Path auto-generated from lowest to highest exit Z. Target key: `stair:ID`. Queries: `reachableLevels()`, `occupiedPositions()`, `exitsAtLevel(z)`, `labelHandle(z)`.
- **`DungeonTransition`** — record: transitionId, mapId, description, anchor (`CubePoint`, nullable for unprepared), destination (`DungeonTransitionDestination`: sealed — `OverworldTileDestination(mapId, tileId)` | `DungeonMapDestination(mapId, transitionId)`), linkedTransitionId (for bidirectional pairs). `isPlaced()` checks non-null anchor. Target key: `transition:ID`. Label: "Übergang N".

### Layer Rules

- Geometry owns all reusable mathematical truth. If logic still makes sense without words like "door", "wall", "room", or "corridor", it belongs in geometry.
- Objects should stay thin — "geometry + one domain rule".
- Structures may query geometry and objects but must not re-implement primitive math.
- Each query has exactly one canonical owner on the lowest sensible layer — no convenience duplicates across layers.
- Runtime state (open/closed/locked) belongs in the `DungeonLayout` door registry, not in geometry or duplicated structure projections. Doors are boundaries; connectivity belongs on `Connection`.
- `Room` is the canonical owner of room-local topology. `RoomCluster` owns only multi-room facts (grouping, adjacency, partition). Application services must not derive room topology from raw geometry.
- Selection/interactions keys are canonical semantic identity. If a structure or boundary owner exposes that identity (for example `RoomCluster.labelHandle().key()` or a corridor target-key API), renderers/coordinators/controllers may consume it but must not locally reconstruct or parse it.
- Corridor bindings are canonical structure truth; absolute corridor geometry is runtime state derived from bindings plus current room/cluster layout.
- `Corridor` is the canonical owner of corridor-local edit truth. Membership changes, waypoint edits, door-binding edits, binding re-anchoring (`reanchoredFor(context)`), and path replanning (`replannedFor(context)`) belong on `Corridor`/`CorridorBindings`, not in application services or interaction controllers. `CorridorRewriteContext` carries the before/after `CorridorPlanningInput` plus affected corridor and deleted cluster IDs for a single topology rewrite step.
- Clean `dungeonmap/` code must not depend on `features.world.quarantine.dungeonmap`. Shared helpers such as transactions, room-topology orchestration, corridor reconciliation, and runtime-state repair belong locally under `application/` when still needed.
- Observable transient state belongs in `state/`, not scattered across shell/canvas packages.
- `DungeonStair` is the canonical owner of stair topology: path, exits, reachable levels. Application services must not reconstruct level connectivity from raw geometry.
- `DungeonTransition` is the canonical owner of transition identity and destination. Transitions may exist unprepared (anchor=null) — services must guard `isPlaced()` before spatial queries. Bidirectional linking is managed by the edit service, not the model.

### Persistence Model

Cluster geometry is stored as relative vertex loops with a center anchor. Rooms store only their anchor cell and cluster membership — runtime floor shapes are hydrated via BFS flood-fill against cluster cells and boundary edges. Boundary persistence still stores `(cell, direction, type)` tuples; canonical `Door` boundary objects are rebuilt once in the `DungeonLayout` registry, while connectivity stays on `Connection` and corridor bindings. Corridors store member room IDs, relative waypoint bindings, and relative door bindings.

Stairs use three tables: `dungeon_stairs` (identity + name), `dungeon_stair_path_nodes` (ordered 3D path), `dungeon_stair_exits` (exit points with labels). Transitions use `dungeon_transitions` with nullable placement coordinates (cell_x/y, level_z — null for unprepared), destination type discriminator (`OVERWORLD_TILE` | `DUNGEON_MAP`), target FKs per type, and optional `linked_transition_id` for bidirectional pairs.
