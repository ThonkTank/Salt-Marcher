# AGENTS.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Scope

This file covers the `dungeonmap` feature — a tile-grid dungeon editor and runtime viewer within the SaltMarcher app. See the root `AGENTS.md` for build commands, project-wide conventions, and the cockpit shell architecture.

## Feature Architecture

The feature ships two `AppView` implementations: `DungeonEditorView` (EDITOR) and `DungeonRuntimeView` (SESSION). Both extend `AbstractDungeonMapView`, which owns a shared `DungeonCanvasWorkspace` and lazy-loads map data on first `onShow()`.

`DungeonMapModule` (`bootstrap/`) is the composition root — it wires all dependencies and exposes the two views to the app shell.

### Current Architecture

- `DungeonLayout` owns only direct top-level structures: corridors, stairs, clusters, transitions.
- Corridors and stairs are first-class persisted owners; there is no second aggregate for connection geometry.
- The editor exposes `ConnectionsTool` for door/corridor authoring. Stair authoring remains deferred.
- Room topology edits and cluster moves do not reroute or rewrite corridors/stairs; those structures remain unchanged unless their own edit workflows persist a new version.

### Package Roles

- `model/` — immutable domain model in three strict layers (see **Model Layering** below)
- `application/` — stateful edit services that orchestrate workflows, transactions, and persistence around topology changes. Organized by domain concern:
  - `application/room/` — room paint topology: `DungeonRoomTopologyService` is the single room topology orchestrator for paint/delete/boundary edits; thin facades may wrap transaction entrypoints but must not re-plan topology outside the model. Exit catalogs: `DoorExitCatalog` groups adjacent connection boundary edges into logical openings via BFS, `RoomExitCatalog` wraps it per-room, `RoomExitDescriptor` carries the result
  - `application/transition/` — inter-map transition lifecycle: `DungeonTransitionEditService` (two-phase create: direct or prepared+place-later, bidirectional linking, delete with cascade), `DungeonTransitionEditRequest` (sealed creation parameters), `DungeonTransitionTargetCatalogService` (loads placed transitions on a target map for destination selection → `DungeonTransitionTargetSummary`)
  - `application/runtime/` — runtime navigation subsystem: `DungeonRuntimeNavigationService` (orchestrator: load position, resolve surface, move party), `DungeonRuntimeLocation` (sealed: Room | Corridor | Tile | StairExit | Transition), `CardinalDirection` (`model/geometry/`, shared 4-direction type with relative-label logic and persistence code), surface pipeline (`DungeonRuntimeSurfaceResolver` → `DungeonRuntimeSurface` → `DungeonRuntimeSurfacePresenter`), door pipeline (`DungeonRuntimeDoorCatalog` enriches exits with destination labels and narration → `DungeonRuntimeDoorDescriptor` adds heading-relative labels), stair pipeline (`DungeonRuntimeStairCatalog` → `DungeonRuntimeStairDescriptor`: filters exits reachable from current level, excludes active tile), transition pipeline (`DungeonRuntimeTransitionCatalog` → `DungeonRuntimeTransitionDescriptor`: resolves destination labels from overworld/dungeon targets), `DungeonRuntimeLabels` (static label generation), `DungeonRuntimeLocations` (location ↔ persistence serialization), `DungeonRuntimeStateRepairService` (consistency repair)
  - `application/support/` — `DungeonTransactionRunner`
  - Services coordinate between model and persistence but must not reconstruct structure truth that already belongs on `Room`, `RoomCluster`, or `Corridor`
- `loading/` — `DungeonMapLoader` (raw JDBC reads) + `DungeonMapLoadingService` (async loading with sequenced request deduplication via `requestSequence` AtomicLong — stale responses discarded). Loader hydrates rooms from stored cluster topology via BFS flood-fill
- `persistence/` — write-side repositories (`DungeonRoomWriteRepository`, `DungeonRoomGeometryWriteMapper`, `DungeonCorridorWriteRepository`, `DungeonStairWriteRepository`, `DungeonTransitionWriteRepository`). Schema helpers (`DungeonSchemaSupport`, `DungeonTransitionSchemaSupport`) for idempotent table creation. Read-side lives in `loading/`
- `catalog/` — map CRUD (create/rename/delete) with its own `application/` + `persistence/` sub-packages
- `canvas/` — JavaFX Canvas rendering, organized into sub-packages:
  - `canvas/base/` — `DungeonCanvasWorkspace` observes `DungeonMapState` directly for map/level/overlay changes, dispatches rendering to the grid `DungeonSceneRenderer`, and owns level-scroll routing (scroll → `mapState.setActiveProjectionLevel()` or custom `IntConsumer` handler, then notifies interaction handler via `levelScrolled(int)`). `showPreview(EditorPreview)` accepts the sealed preview type directly. All internal state setters route through `notifyViewChanged()` with equality guard clauses for idempotent change propagation. `DungeonRenderState` carries shared render inputs. `DungeonCanvasCamera` handles pan (right-drag) and zoom (scroll, 0.2–5.0×). `DungeonCanvasInteractionHandler` routes pointer events to `DungeonCanvasPointerEvent` with cell coordinates; `levelScrolled(int)` is a void notification (workspace owns the level change). `DungeonCanvasTheme` provides drawing constants
  - `canvas/grid/` — `DungeonGridSceneRenderer` (tile-based view: background, grid, room fills/outlines, walls, doors, corridor cells/doors, interactive labels, axes), `DungeonGridInteractiveLabels`
- `shell/` — view and UI coordinator layer:
  - `shell/editor/` — `DungeonEditorView` (owns all state listener wiring: map state → controls, session state → tool activation, interaction state → workspace preview/selection), `DungeonEditorControls`, `DungeonEditorStatePane`
  - `shell/editor/controls/` — left-panel UI: `MapControls` (map selector/CRUD), `ToolControls` (tool palette), `ViewModeControls` (grid/graph toggle), `ToolFamilyDropdownController`, `GuardState`
  - `shell/editor/interaction/` — `EditorInteraction` dispatches canvas events to `EditorTool` implementations (`SelectionTool`, `PaintTool`, `BoundaryTool`, `ConnectionsTool`, `TransitionTool`). Tool-local transient state stays inside the tool unless it must be shared via `state/`
  - `shell/controls/` — shared controls: `DungeonLevelOverlayControls` (configures multi-level overlay rendering)
  - `shell/runtime/` — `DungeonRuntimeView` (publishes surfaces to `DetailsNavigator`, wires drag-to-move interaction), `DungeonRuntimeInteractionController` (drag-to-move: press on party tile → drag preview → release commits move)
- `state/` — observable transient state containers with `CopyOnWriteArrayList` listener lists. These are the single source of truth for cross-class coordination:
  - `DungeonMapState` — loaded map data (catalog entries, active `DungeonLayout`, loading/error state)
  - `DungeonEditorSessionState` — current tool + view mode
  - `EditorInteractionState` — shared editor interaction state: selected `DungeonSelectionKey`, active `EditorPreview`, active `EditorDraft`. `DungeonHitSubject` remains event-time hit metadata only
  - `EditorPreview` — sealed preview payloads for dragged cluster layouts, room paint/delete shapes, and boundary path overlays
  - `EditorDraft` — sealed shared drafts for boundary-path status
  - Transition placement state stays tool-local inside `TransitionTool`. Do not reintroduce parallel shared listener channels for transition-private draft state
  - `DungeonLevelOverlaySettings` — overlay mode (`DungeonLevelOverlayMode`: OFF | NEARBY±range | SELECTED levels), opacity, level range
  - `DungeonRuntimeState` — active location + heading, loading/dragging/moving mode flags, error state

### Quarantine

`features/world/quarantine/dungeonmap/` is retained only as legacy code outside the clean feature. `features/world/dungeonmap/` must not import from `features.world.quarantine.dungeonmap`; migrate any needed behavior into the clean package structure instead of reintroducing cross-package bridges.

## Concern Ownership

The domain-model ownership rules below apply to the full interaction pipeline, not only to `model/`. Treat each mutable concern as having exactly one authoritative owner from input capture through persisted outcome.

- Give each concern exactly one authoritative owner. A concern is any mutable fact or workflow with a central truth: selection, active gesture, preview, draft, loaded map state, persisted edit result, runtime position, corridor bindings, cluster topology.
- Place ownership at the lowest layer that actually interprets, edits, validates, or completes that concern.
- Higher layers may trigger, observe, or render a concern, but must not mirror, cache, reconstruct, or locally finalize it.
- If two classes can both answer "what is the current truth of this concern?", the architecture has already drifted.

### Layered Concern Boundaries

- UI shell and canvas code own raw input capture, focus, pointer routing, and rendering only. They must not define domain meaning or locally complete edits.
- Interaction/tool code owns gesture lifecycle and UI-to-domain intent translation. Tool-local gesture state stays on the active tool unless multiple collaborators truly need a shared draft.
- Shared state containers in `state/` own only cross-class coordination state. They are not a dumping ground for every transient variable and must not become hidden workflow engines.
- Domain/model objects own domain meaning and structural truth. If a capability is edited, described, constrained, or replanned as part of the domain, the owning model object must answer for it directly.
- Application services own orchestration, transaction boundaries, persistence sequencing, and async completion wiring. They must not maintain a second domain interpretation of the same edit.
- Persistence owns stored truth. Loading/rehydration owns reconstruction of the current working projection from stored truth. Neither may be bypassed by silent UI-side "final" state.
- Layering is a coordination tool, not a license to split one domain operation into separate preview logic, separate commit logic, and separate reload-repair logic. If preview and commit both need the same domain semantics, they must reuse the same canonical operation rather than carry near-duplicate implementations in different layers.
- Do not treat reload as a normal way to reconcile partial writes or semantic drift between layers. Reload is the authoritative rebuild step after a complete write, not a substitute for an incomplete commit pipeline.

### No Shadow State

- Do not duplicate mutable concern state across view, interaction, application, loading, and persistence layers.
- Projections are disposable views of owner state, not second truths.
- Preview is never commit state.
- Selection is never model state.
- Loaded working state is never a second domain model with its own independent edit truth.
- Render state is never workflow state.
- If recovery depends on "reload will probably fix it", ownership is too diffuse.

### Single Canonical Flow

- Every mutable concern must follow one canonical path from input to persisted outcome.
- UI captures input.
- Interaction interprets intent.
- Domain/application executes the operation.
- Persistence records the result.
- Loading/rehydration restores the authoritative working state.
- No other layer may run a parallel "almost the same" commit pipeline for the same concern.
- Preview paths may reuse canonical model logic, but they must remain explicitly speculative and must not silently become authoritative state.
- This layering is the preferred standard for the feature only when the domain semantics are defined exactly once. A flow is not a good reference model if the UI preview, application service, and persistence path each carry their own version of what the operation means.
- When evaluating or designing a workflow, prefer fewer semantic owners over thinner layers. A slightly deeper domain/application operation is better than multiple shallow layers that each reconstruct part of the same mutation.

### Completion And Failure Semantics

- A concern is complete only where its owner completes it. Async scheduling or optimistic rendering does not transfer ownership.
- Every async mutating workflow must define pending, success, and failure behavior explicitly.
- On success, temporary interaction artifacts must be cleared and the working state must converge on the authoritative persisted result.
- On failure, non-owner projections must be discarded or rebuilt from the authoritative owner. Showing an error while leaving speculative state in place is architectural drift.

### Traceability Rules

- For every mutable concern, a maintainer must be able to answer:
  1. Who owns it?
  2. Which layer may change it?
  3. Which layers may only observe or render it?
  4. Where does it become persisted truth?
  5. How is it rebuilt after reload?
- If answering those questions requires synchronizing multiple partial owners, the design is wrong.
- Prefer asking the owner over re-deriving truth from neighboring objects.
- Prefer one deeper owner with a clear API over multiple shallow helpers that each know part of the truth.

### Data Flow

1. `DungeonMapLoadingService.ensureLoaded()` → `CompletableFuture` → `DungeonMapLoader` (JDBC) → `DungeonMapLoadResult`
2. Result delivered to `DungeonMapState.showLoaded()` on FX thread via `Platform.runLater`
3. State listeners fire → `DungeonCanvasWorkspace.setMapModel()` → `notifyViewChanged()` → `redraw()`
4. Edit flow: `EditorInteraction`/active `EditorTool` → edit service → topology/corridor services + write repositories persist in one transaction → reload

### Editor Interaction Model

`DungeonEditorTool` enum defines tool modes (SELECT, ROOM_PAINT, ROOM_DELETE, CLUSTER_WALL/DOOR, TRANSITION_CREATE/DELETE). Tools are grouped into `ToolFamily` for the dropdown toolbar. `DungeonEditorSessionState` holds current tool + view mode.

`EditorInteraction` dispatches events by active `EditorTool`:
- **SELECT** → `SelectionTool` — click selects clusters/rooms/stairs/transitions via `EditorInteractionState`, drag shows translated cluster preview via `EditorPreview.LayoutPreview`, and the state pane exposes room narration editing
- **ROOM_PAINT / ROOM_DELETE** → `PaintTool` — manages `RoomPaintSession`, clears selection on paint start, updates `EditorPreview.PaintPreview` during drag, calls `DungeonRoomTopologyService.paint()`/`.delete()` on release
- **CLUSTER_WALL / CLUSTER_WALL_DELETE** → `BoundaryTool` — owns the wall-path draft locally, publishes overlay edges through `EditorPreview.BoundaryPreview`, and stores only lightweight status/selection in shared state
- **CONNECTIONS / CONNECTIONS_DELETE** → `ConnectionsTool` — owns door/corridor authoring, direct corridor-graph edits, and corridor-first state-pane actions. Corridor previews must be derived from canonical `Corridor` graph truth instead of a second canvas-local geometry model
- **TRANSITION_CREATE / TRANSITION_DELETE** → `TransitionTool` — create either places a prepared transition or creates+places atomically from the tool-local transition draft. Delete click-targets transition at cell

Canvas pointer events flow through `DungeonCanvasInteractionHandler` → `handlePressed`/`handleDragged`/`handleReleased` → state update → redraw. Level scrolls are workspace-owned: workspace changes `mapState.activeProjectionLevel` directly, then notifies the handler via `levelScrolled(int)` so tools can react (e.g. `SelectionTool` updates `dragSession.currentLevel`). Hit testing runs through the shared pipeline: editor and runtime build a `DungeonHitProbe`, `DungeonHitCollector` produces a `DungeonHitSnapshot`, and selection/tools consume `DungeonSelection` subjects directly.

### Runtime Navigation Model

`DungeonRuntimeInteractionController` implements drag-to-move: press on the party tile starts a drag, `DungeonRuntimeState.showDragPreview()` renders the preview, release commits the move via `DungeonRuntimeNavigationService.moveToTile()`/`moveThroughDoor()`.

After each move, the runtime view resolves the new location into a presentable surface:

1. `DungeonRuntimeSurfaceResolver` pattern-matches on `DungeonRuntimeLocation` (sealed: Room | Corridor | Tile | StairExit | Transition) → builds `DungeonRuntimeSurface` (title, entry key, visual description, door list, stair list, transition list)
2. Door enrichment pipeline: structures expose connection boundaries, `DungeonLayout` owns the canonical door registry (`VertexEdge -> Door`), `DoorExitCatalog` groups adjacent boundary edges into openings, then `DungeonRuntimeDoorCatalog`/`DungeonRuntimeDoorDescriptor` add destination labels, narration, and heading-relative labels
3. Stair enrichment: `DungeonRuntimeStairCatalog` finds stairs with exits on the current level within the surface's cells, builds `DungeonRuntimeStairDescriptor` with destination labels and target locations (excludes exits at the active tile)
4. Transition enrichment: `DungeonRuntimeTransitionCatalog` finds placed transitions at the surface's cells/level, builds `DungeonRuntimeTransitionDescriptor` with destination labels (overworld tile or dungeon map + target transition)
5. `DungeonRuntimeSurfacePresenter` converts the surface into JavaFX nodes → published to `DetailsNavigator`

`DungeonRuntimeLabels` provides all display strings (room names, corridor labels joining connected room names, tile coordinates, heading names, stair/transition structure labels at tiles). `DungeonRuntimeLocations` handles bidirectional conversion between `DungeonRuntimeLocation` and the persisted campaign-state format.

Room/corridor narration is model-owned (`RoomNarration`, `RoomExitNarration`). Surface resolution and label generation are static utilities in `application/runtime/`. Do not introduce a separate runtime details panel — surfaces are published through the shared `DetailsNavigator`.

### State Wiring

Each component observes the state objects it needs directly — no coordinator middleman:
- `DungeonCanvasWorkspace` observes `DungeonMapState` directly for map/level/overlay → `syncFromMapState()` → `redraw()`
- `DungeonEditorView` wires listeners in its constructor:
  - `EditorInteractionState` → `workspace.setSelectedTargetKey()` + `workspace.showPreview()`
  - `DungeonEditorSessionState` → `workspace.setViewMode()`, tool activation, controls refresh
  - `DungeonMapState` → controls refresh, tool reactivation on map switch
- Level scroll is workspace-owned: scroll event → `mapState.setActiveProjectionLevel()` (or custom handler via `setOnLevelScrollRequested()`) → tool notified via `levelScrolled(int)`. Runtime view uses the custom handler for reachable-level clamping.

### Room Topology Reload Semantics

Room paint/delete/boundary edits persist only cluster and room truth in this feature slice. Corridors keep their own node/segment truth, and stairs keep their own explicit path truth. After a successful write, a reload rebuilds all derived corridor/stair projections from persisted geometry plus the current room layout.

## Model Layering

`model/` is split into three layers with strict dependency direction:

```
geometry/  →  objects/  →  structures/
```

- **`geometry/`** — Pure grid math primitives: `Point2i`, `CubePoint` (3D grid coordinate), `Tile`, `TileShape`, `VertexEdge`, `VertexPath`, `BoundaryNetwork`, `GridAnchor`, `GridRoute`. Domain-agnostic. No knowledge of walls, doors, rooms.
- **`objects/`** — Thin domain objects over geometry: `Floor`, `Wall`, `Door`. `Door` is the boundary object and runtime/registry carrier for passability state; connectivity lives on `Connection`.
- **`structures/`** — Self-managed compositions: `Room`, `RoomCluster`, `Corridor`, `DungeonStair`, `DungeonTransition`. Compose objects and own structure-level behavior.

`DungeonLayout` is the immutable global lookup layer over structures. Mutations return new instances. Key aggregate queries: `overlappingClusters(TileShape)`, spatial indexes for stairs and transitions (`stairsAtCell(cell, z)`, `stairsAtLevel(z)`, `transitionsAtCell(cell, z)`, `transitionsAtLevel(z)`, `findStair(id)`, `findTransition(id)`), and the canonical room/corridor connection registry. Stair exit positions are included in traversable cells.

### Key Structures

- **`Room`** — record: roomId, mapId, clusterId, name, Floor, Walls, `RoomNarration` (visual description + per-exit `RoomExitNarration` entries). `resolved()` keeps room-owned wall boundaries canonical. Connectivity is queried through layout connections instead of mirrored room-local door state.
- **`RoomCluster`** — groups rooms spatially, manages adjacency via overlap indexing, and owns cluster-local rewrite logic for paint/delete/boundary changes. `movedBy()` handles translation. Produces `InteractiveLabelHandle` for canvas rendering.
- **`Corridor`** — first-class horizontal structure: corridorId, mapId, one `levelZ`, stable corridor nodes, stable corridor segments, and corridor-local room bindings on nodes. `Corridor` derives its own `CorridorPath`, occupied cells/floors, corridor-local `Connection`s, and room queries for labels/graph/runtime directly from that graph
- **`DungeonStair`** — first-class vertical structure: stairId, mapId, name, ordered 3D path (`List<CubePoint>`) as canonical geometry. `DungeonStairExit` values are read-only projections derived from the path nodes that lie on occupied Room-/Corridor-floor cells. Target key: `stair:ID`. Queries: `reachableLevels()`, `occupiedPositions()`, `exitsAtLevel(z)`, `labelHandle(z)`
- **`DungeonTransition`** — record: transitionId, mapId, description, anchor (`CubePoint`, nullable for unprepared), destination (`DungeonTransitionDestination`: sealed — `OverworldTileDestination(mapId, tileId)` | `DungeonMapDestination(mapId, transitionId)`), linkedTransitionId (for bidirectional pairs). `isPlaced()` checks non-null anchor. Target key: `transition:ID`. Label: "Übergang N".

### Layer Rules

- Geometry owns all reusable mathematical truth. If logic still makes sense without words like "door", "wall", "room", or "corridor", it belongs in geometry.
- Objects should stay thin — "geometry + one domain rule".
- Structures may query geometry and objects but must not re-implement primitive math.
- Each query has exactly one canonical owner on the lowest sensible layer — no convenience duplicates across layers.
- Runtime state (open/closed/locked) belongs in the `DungeonLayout` door registry, not in geometry or duplicated structure projections. Doors are boundaries; connectivity belongs on `Connection`.
- `Room` is the canonical owner of room-local topology. `RoomCluster` owns only multi-room facts (grouping, adjacency, partition). Application services must not derive room topology from raw geometry.
- Selection/interactions keys are canonical semantic identity. If a structure or boundary owner exposes that identity (for example `RoomCluster.labelHandle().key()` or a corridor target-key API), renderers/coordinators/controllers may consume it but must not locally reconstruct or parse it.
- Clean `dungeonmap/` code must not depend on `features.world.quarantine.dungeonmap`. Shared helpers such as transactions, room-topology orchestration, corridor reconciliation, and runtime-state repair belong locally under `application/` when still needed.
- Observable transient state belongs in `state/`, not scattered across shell/canvas packages.
- `Corridor` is a first-class structure with stable identity, path, connections, and corridor-local rules.
- `DungeonStair` is a first-class structure with stable identity and stair-local path geometry. Whole-stair regeneration may use helper generators, but persisted stair truth is always the explicit 3D path.
- `DungeonTransition` is the canonical owner of transition identity and destination. Transitions may exist unprepared (anchor=null) — services must guard `isPlaced()` before spatial queries. Bidirectional linking is managed by the edit service, not the model.

### Persistence Model

Cluster geometry is stored as relative vertex loops with a center anchor. Rooms store only their anchor cell and cluster membership — runtime floor shapes are hydrated via BFS flood-fill against cluster cells and boundary edges. Boundary persistence still stores `(cell, direction, type)` tuples; canonical `Door` boundary objects are rebuilt once in the `DungeonLayout` registry, while connectivity stays on `Connection`. Corridors persist their own stable structure identity and geometry. Stairs persist only stable identity plus ordered path nodes; exits are derived during load from path nodes that intersect occupied Room-/Corridor-floor cells.

Stairs use two tables: `dungeon_stairs` (stable identity + name) and `dungeon_stair_path_nodes` (ordered 3D path as canonical geometry). Transitions use `dungeon_transitions` with nullable placement coordinates (cell_x/y, level_z — null for unprepared), destination type discriminator (`OVERWORLD_TILE` | `DUNGEON_MAP`), target FKs per type, and optional `linked_transition_id` for bidirectional pairs.
