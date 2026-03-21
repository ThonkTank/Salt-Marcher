# AGENTS.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Scope

This file covers the `dungeonmap` feature — a tile-grid dungeon editor and runtime viewer within the SaltMarcher app. See the root `CLAUDE.md` for build commands, project-wide conventions, and the cockpit shell architecture.

## Feature Architecture

The feature ships two `AppView` implementations: `DungeonEditorView` (EDITOR) and `DungeonRuntimeView` (SESSION). Both extend `AbstractDungeonMapView`, which owns a shared `DungeonCanvasWorkspace` and lazy-loads map data on first `onShow()`.

`DungeonMapModule` is the composition root — it wires all dependencies and exposes the two views to the app shell.

### Package Roles

- `model/` — immutable domain model in three strict layers (see **Model Layering** below)
- `application/` — stateful edit services that plan and persist topology changes. Services coordinate between model and persistence, but must not reconstruct structure truth that already belongs on `Room`, `RoomCluster`, or `Corridor`
- `loading/` — `DungeonMapLoader` (raw JDBC reads) + `DungeonMapLoadingService` (async loading with sequenced request deduplication). Loader hydrates rooms from stored cluster topology via BFS flood-fill
- `persistence/` — write-side repositories (`DungeonRoomWriteRepository`, `DungeonRoomGeometryWriteMapper`). Read-side lives in `loading/`
- `catalog/` — map CRUD (create/rename/delete) with its own `application/` + `persistence/` sub-packages
- `canvas/` — JavaFX Canvas rendering. `DungeonCanvasWorkspace` dispatches to a `DungeonSceneRenderer` based on `DungeonViewMode` (GRID vs GRAPH). Shared render inputs travel through `DungeonRenderState` so renderers depend on one compact render-state object instead of a widening parameter list. Camera handles pan (right-drag) and zoom (scroll). Pointer events are translated to `DungeonCanvasPointerEvent` with cell coordinates
- `shell/` — view and UI coordinator layer. `DungeonEditorCoordinator` is the central wiring hub: it binds controls, tools, interaction controllers, and state listeners. Editor interactions are in `shell/editor/interaction/`
- `state/` — observable transient state containers with listener lists (`DungeonMapState`, `DungeonEditorSessionState`, `EditorSelectionState`, `EditorLayoutPreviewState`, `EditorPaintPreviewState`, `DungeonCorridorDraftState`). These are the single source of truth for cross-class coordination
- `bootstrap/` — `DungeonMapModule` composition root

### Quarantine

`features/world/quarantine/dungeonmap/` is retained only as legacy code outside the clean feature. `features/world/dungeonmap/` must not import from `features.world.quarantine.dungeonmap`; migrate any needed behavior into the clean package structure instead of reintroducing cross-package bridges.

### Data Flow

1. `DungeonMapLoadingService.ensureLoaded()` → `CompletableFuture` → `DungeonMapLoader` (JDBC) → `DungeonMapLoadResult`
2. Result delivered to `DungeonMapState.showLoaded()` on FX thread via `Platform.runLater`
3. State listeners fire → `DungeonCanvasWorkspace.setMapModel()` → `redraw()`
4. Edit flow: interaction controller → edit service → clean topology/corridor services + write repositories persist in one transaction → reload

### Editor Interaction Model

`DungeonEditorTool` enum defines tool modes (SELECT, ROOM_PAINT, ROOM_DELETE, CLUSTER_WALL/DOOR, CORRIDOR_CREATE/DELETE). Tools are grouped into `ToolFamily` for the dropdown toolbar. `DungeonEditorSessionState` holds current tool + view mode.

`DungeonEditorGridInteractionController` delegates to specialized controllers: `ClusterSelectionDragController` for select/drag, `RoomPaintInteractionController` for paint/erase. Canvas pointer events flow through `DungeonCanvasInteractionHandler` → controller → state update → redraw.

## Model Layering

`model/` is split into three layers with strict dependency direction:

```
geometry/  →  objects/  →  structures/
```

- **`geometry/`** — Pure grid math primitives: `Point2i`, `Tile`, `TileShape`, `VertexEdge`, `VertexPath`, `BoundaryNetwork`, `GridAnchor`, `GridRoute`. Domain-agnostic. No knowledge of walls, doors, rooms.
- **`objects/`** — Thin domain objects over geometry: `Floor`, `Wall`, `Door`, `BoundaryObject`, `CorridorPath`. Each adds exactly one domain rule (e.g., traversal state) to a geometry primitive.
- **`structures/`** — Self-managed compositions: `Room`, `RoomCluster`, `Corridor`, `CorridorNetwork`. Compose objects and own structure-level behavior.

`DungeonLayout` is the thin global lookup layer over structures.

### Layer Rules

- Geometry owns all reusable mathematical truth. If logic still makes sense without words like "door", "wall", "room", or "corridor", it belongs in geometry.
- Objects should stay thin — "geometry + one domain rule".
- Structures may query geometry and objects but must not re-implement primitive math.
- Each query has exactly one canonical owner on the lowest sensible layer — no convenience duplicates across layers.
- Runtime state (open/closed/locked) belongs in objects, not geometry.
- `Room` is the canonical owner of room-local topology. `RoomCluster` owns only multi-room facts (grouping, adjacency, partition). Application services must not derive room topology from raw geometry.
- Corridor bindings are canonical structure truth; absolute corridor geometry is runtime state derived from bindings plus current room/cluster layout.
- `Corridor` is the canonical owner of corridor-local edit truth. Membership changes, waypoint edits, door-binding edits, and binding re-anchoring belong on `Corridor`/`CorridorBindings`, not in application services or interaction controllers.
- Clean `dungeonmap/` code must not depend on `features.world.quarantine.dungeonmap`. Shared helpers such as transactions, room-topology orchestration, corridor reconciliation, and runtime-state repair belong locally under `application/` when still needed.
- Observable transient state belongs in `state/`, not scattered across shell/canvas packages.

### Persistence Model

Cluster geometry is stored as relative vertex loops with a center anchor. Rooms store only their anchor cell and cluster membership — runtime floor shapes are hydrated via BFS flood-fill against cluster cells and boundary edges. Edge objects (walls/doors) are stored per-cluster as `(cell, direction, type)` tuples. Corridors store member room IDs, relative waypoint bindings, and relative door bindings.
