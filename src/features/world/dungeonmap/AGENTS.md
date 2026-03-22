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
  - `application/room/` — room paint topology: `DungeonRoomTopologyService` (orchestrator), `RoomPaintTopologyPlanner`, `RoomTopologyEditPlan` (sealed, 6 concrete types) / `RoomTopologyEditPlanApplier`
  - `application/corridor/` — corridor lifecycle: `DungeonCorridorEditService` (CRUD), `DungeonCorridorPersistenceService` (batch persistence coordination — persist/delete corridors in a transaction), `DungeonCorridorRewriteCoordinator` (orchestrates corridor rewrite: delegates reanchor + replan to `Corridor` via `CorridorRewriteContext`), `DungeonCorridorRoomRewriteService` (rewrites corridor room membership after topology changes — merge/delete/split), `DungeonCorridorDetailService`
  - `application/runtime/` — `DungeonRuntimeStateRepairService`, `DungeonRuntimeLocation`
  - `application/support/` — `DungeonTransactionRunner`
  - Services coordinate between model and persistence but must not reconstruct structure truth that already belongs on `Room`, `RoomCluster`, or `Corridor`
- `loading/` — `DungeonMapLoader` (raw JDBC reads) + `DungeonMapLoadingService` (async loading with sequenced request deduplication via `requestSequence` AtomicLong — stale responses discarded). Loader hydrates rooms from stored cluster topology via BFS flood-fill
- `persistence/` — write-side repositories (`DungeonRoomWriteRepository`, `DungeonRoomGeometryWriteMapper`, `DungeonCorridorWriteRepository`). Read-side lives in `loading/`
- `catalog/` — map CRUD (create/rename/delete) with its own `application/` + `persistence/` sub-packages
- `canvas/` — JavaFX Canvas rendering, organized into sub-packages:
  - `canvas/base/` — `DungeonCanvasWorkspace` dispatches to a `DungeonSceneRenderer` based on `DungeonViewMode` (GRID vs GRAPH). All state setters route through `notifyViewChanged()` with equality guard clauses for idempotent change propagation. `DungeonRenderState` carries shared render inputs. `DungeonCanvasCamera` handles pan (right-drag) and zoom (scroll, 0.2–5.0×). `DungeonCanvasInteractionHandler` translates pointer events to `DungeonCanvasPointerEvent` with cell coordinates. `DungeonCanvasTheme` provides drawing constants
  - `canvas/grid/` — `DungeonGridSceneRenderer` (tile-based view: background, grid, room fills/outlines, walls, doors, corridor cells/doors, interactive labels, axes), `DungeonGridInteractiveLabels`
  - `canvas/graph/` — `DungeonGraphSceneRenderer` (node-graph view)
- `shell/` — view and UI coordinator layer:
  - `shell/editor/` — `DungeonEditorView`, `DungeonEditorCoordinator` (central wiring hub: binds controls, tools, interaction controllers, and state listeners with separate listener methods per state concern), `DungeonEditorControls`, `DungeonEditorStatePane`
  - `shell/editor/controls/` — left-panel UI: `MapControls` (map selector/CRUD), `ToolControls` (tool palette), `ViewModeControls` (grid/graph toggle), `ToolFamilyDropdownController`, `GuardState`
  - `shell/editor/interaction/` — event dispatch and per-tool controllers (see **Editor Interaction Model** below)
  - `shell/runtime/` — `DungeonRuntimeView`
- `state/` — observable transient state containers with `CopyOnWriteArrayList` listener lists. These are the single source of truth for cross-class coordination:
  - `DungeonMapState` — loaded map data (catalog entries, active `DungeonLayout`, loading/error state)
  - `DungeonEditorSessionState` — current tool + view mode
  - `EditorSelectionState` — selected target key (e.g. `"cluster:123"`, `"corridor:456"`)
  - `EditorLayoutPreviewState` — dragged cluster preview (`DungeonLayout` with translated cluster)
  - `EditorPaintPreviewState` — paint/delete preview shape + mode
  - `DungeonCorridorDraftState` — pending corridor endpoint for two-click creation flow

### Quarantine

`features/world/quarantine/dungeonmap/` is retained only as legacy code outside the clean feature. `features/world/dungeonmap/` must not import from `features.world.quarantine.dungeonmap`; migrate any needed behavior into the clean package structure instead of reintroducing cross-package bridges.

### Data Flow

1. `DungeonMapLoadingService.ensureLoaded()` → `CompletableFuture` → `DungeonMapLoader` (JDBC) → `DungeonMapLoadResult`
2. Result delivered to `DungeonMapState.showLoaded()` on FX thread via `Platform.runLater`
3. State listeners fire → `DungeonCanvasWorkspace.setMapModel()` → `notifyViewChanged()` → `redraw()`
4. Edit flow: interaction controller → edit service → topology/corridor services + write repositories persist in one transaction → reload

### Editor Interaction Model

`DungeonEditorTool` enum defines tool modes (SELECT, ROOM_PAINT, ROOM_DELETE, CLUSTER_WALL/DOOR, CORRIDOR_CREATE/DELETE). Tools are grouped into `ToolFamily` for the dropdown toolbar. `DungeonEditorSessionState` holds current tool + view mode.

`DungeonEditorGridInteractionController` dispatches events by tool:
- **SELECT** → `ClusterSelectionDragController` — click selects cluster (via `EditorSelectionState`), drag shows translated cluster preview (via `EditorLayoutPreviewState`)
- **ROOM_PAINT / ROOM_DELETE** → `RoomPaintInteractionController` — manages `RoomPaintSession` (startCell, endCell, deleteMode), updates `EditorPaintPreviewState` during drag, calls `roomEditService.paint()`/`.delete()` on release
- **CORRIDOR_CREATE / CORRIDOR_DELETE** → `CorridorInteractionController` — two-click flow via `DungeonCorridorDraftState` (first click stores pending endpoint, second click finalizes), sealed `CorridorEndpoint` (Room | Corridor)

Canvas pointer events flow through `DungeonCanvasInteractionHandler` → `handlePressed`/`handleDragged`/`handleReleased` → state update → redraw. Hit testing: `DungeonGridHitTester` returns `DungeonEditorHitTarget` / `DungeonEditorLabelHitTarget` for cluster/room/corridor at canvas point.

### Coordinator Wiring (DungeonEditorCoordinator)

The coordinator is the glue layer that connects state, canvas, and interaction controllers:
- `sessionState` changes → `workspace.setViewMode()` (renderer switch)
- `selectionState` changes → `workspace.setSelectedTargetKey()` (highlight re-render)
- `paintPreviewState` changes → `workspace.setPreviewPaintShape()` (paint overlay)
- `layoutPreviewState` changes → `workspace.setPreviewMapModel()` (moved cluster overlay)
- `corridorDraftState` changes → state pane hint update

Each state concern has a dedicated listener method — no monolithic refresh.

### Room Topology Edit → Corridor Rewrite Flow

When rooms are painted, deleted, or merged, affected corridors must be reanchored and replanned:

1. `DungeonRoomTopologyService` applies room topology edit plan
2. Detects affected corridors via `DungeonLayout.corridorsAffectedBy(ClusterRewrite)`
3. Creates `CorridorRewriteContext` (before/after `CorridorPlanningInput`, affected corridor IDs, deleted cluster IDs)
4. `DungeonCorridorRewriteCoordinator.rewriteCorridors()` — for each affected corridor:
   - `corridor.reanchoredFor(context)` — re-target waypoint/door bindings to new cluster centers (relative offsets survive cluster movement)
   - `corridor.replannedFor(context)` — recompute corridor path via `CorridorPlanner`
5. All changes (room topology + corridors) persisted in one transaction

### Corridor Planning Algorithm (CorridorPlanner)

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

- **`geometry/`** — Pure grid math primitives: `Point2i`, `Tile`, `TileShape`, `VertexEdge`, `VertexPath`, `BoundaryNetwork`, `GridAnchor`, `GridRoute`. Domain-agnostic. No knowledge of walls, doors, rooms.
- **`objects/`** — Thin domain objects over geometry: `Floor`, `Wall`, `Door`, `BoundaryObject`, `CorridorPath`. Each adds exactly one domain rule (e.g., traversal state) to a geometry primitive.
- **`structures/`** — Self-managed compositions: `Room`, `RoomCluster`, `Corridor`, `CorridorNetwork`. Compose objects and own structure-level behavior.

`DungeonLayout` is the immutable global lookup layer over structures. Mutations return new instances. Pre-computes corridor networks dynamically via `CorridorNetwork.buildNetworks()`. Key aggregate queries: `corridorsAffectedBy(ClusterRewrite)`, `overlappingClusters(TileShape)`, `corridorPlanningInput()`.

### Key Structures

- **`Room`** — record: roomId, mapId, clusterId, name, Floor, Walls, Doors. `resolved()` factory ensures canonical wall/door set (walls cover all perimeter edges except where doors exist). Boundary normalization auto-synthesizes missing walls.
- **`RoomCluster`** — groups rooms spatially, manages adjacency via overlap indexing. `simplePaintExpansion()` for room topology changes, `movedBy()` for translation. Produces `InteractiveLabelHandle` for canvas rendering.
- **`Corridor`** — record: corridorId, mapId, roomIds, `CorridorBindings` (canonical relative truth), `CorridorPath` (runtime derived geometry). Bindings store waypoints and door entries as relative offsets from cluster centers → survive cluster movement without re-editing. Mutation methods: `withAddedRoom()`, `mergeWith()`, `reanchoredFor()`, `replannedFor()`.

### Layer Rules

- Geometry owns all reusable mathematical truth. If logic still makes sense without words like "door", "wall", "room", or "corridor", it belongs in geometry.
- Objects should stay thin — "geometry + one domain rule".
- Structures may query geometry and objects but must not re-implement primitive math.
- Each query has exactly one canonical owner on the lowest sensible layer — no convenience duplicates across layers.
- Runtime state (open/closed/locked) belongs in objects, not geometry.
- `Room` is the canonical owner of room-local topology. `RoomCluster` owns only multi-room facts (grouping, adjacency, partition). Application services must not derive room topology from raw geometry.
- Corridor bindings are canonical structure truth; absolute corridor geometry is runtime state derived from bindings plus current room/cluster layout.
- `Corridor` is the canonical owner of corridor-local edit truth. Membership changes, waypoint edits, door-binding edits, binding re-anchoring (`reanchoredFor(context)`), and path replanning (`replannedFor(context)`) belong on `Corridor`/`CorridorBindings`, not in application services or interaction controllers. `CorridorRewriteContext` carries the before/after `CorridorPlanningInput` plus affected corridor and deleted cluster IDs for a single topology rewrite step.
- Clean `dungeonmap/` code must not depend on `features.world.quarantine.dungeonmap`. Shared helpers such as transactions, room-topology orchestration, corridor reconciliation, and runtime-state repair belong locally under `application/` when still needed.
- Observable transient state belongs in `state/`, not scattered across shell/canvas packages.

### Persistence Model

Cluster geometry is stored as relative vertex loops with a center anchor. Rooms store only their anchor cell and cluster membership — runtime floor shapes are hydrated via BFS flood-fill against cluster cells and boundary edges. Edge objects (walls/doors) are stored per-cluster as `(cell, direction, type)` tuples. Corridors store member room IDs, relative waypoint bindings, and relative door bindings.
