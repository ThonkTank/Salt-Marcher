# AGENTS.md

This file covers `src/features/world/dungeonmap/shell/editor/interaction/`.
Use it together with `shell/AGENTS.md`, the parent `dungeonmap/AGENTS.md`, and the repository root `AGENTS.md`.

## Editor Pipeline

- `EditorInteraction` runs the canonical editor pipeline: collect the shared hit snapshot, ask the active tool for ordered interaction capabilities, execute the first matching capability, store hover intent, then dispatch press/drag/release with an `EditorToolContext`.
- `EditorTool.interactionCapabilities(...)` is the tool-owned declaration of "what this tool reacts to". Hover, hit resolution, and click handling must stay aligned through that one ordered capability list.
- `EditorTool` implementations own gesture meaning. Promote state into shared containers only when multiple collaborators truly need it.

## Tool Ownership

- `SelectionTool` owns semantic selection, cluster drag, whole-stair drag, door drag, and corridor-node drag.
- Selecting a stair in `SelectionTool` must open the same stair editor state used by `ConnectionsTool`; do not fork a second stair form or second stair draft owner.
- Dragging a plain corridor tile first promotes that tile to an explicit node. Clicking a corridor tile without drag must not create state.
- `PaintTool` owns room paint/delete sessions from resolved `GridCellRef` hits and publishes previews as `CellCoord` sets, not temporary structures.
- `FloorTool` owns floor paint/delete sessions inside existing room surface. It reuses the shared rectangular drag-window helper with `PaintTool`, but filters preview and commit cells back down to valid room cells on the active level.
- `BoundaryTool` owns wall-path drafting. Delete mode may remove local door segments as part of one barrier path. Draft state stays local and shared state exposes only preview geometry.
- `ConnectionsTool` owns door edits, surface-driven corridor authoring, corridor graph delete gestures, and the shared stair draft/edit UX consumed by both connection editing and stair selection. Boundary eligibility for door-like placement is shared with `TransitionTool` through one common surface helper instead of parallel tool-local checks.
- Stair editing in `ConnectionsTool` authors exit levels as explicit local UI state; the currently selected exit is the active stair anchor and every preview/commit replan must derive from that anchor instead of a hidden min/max range control.
- Create semantics stay surface-driven: interior editable room walls create local doors, `room exterior wall <-> room exterior wall` creates a corridor, `room exterior wall <-> free corridor wall` attaches another room to an existing corridor, room-floor clicks start stair drafts, and existing doors/corridors/stairs are selected directly.
- Pending wall flows and open stair drafts stay tool-local, are cancelled with right click, and do not justify filler state-pane hints while no connection instance is selected.
- Stair validation and path resolution stay in `application/stair/`, even when the UI for stair forms and previews lives on `ConnectionsTool`.
- `TransitionTool` owns transition create/delete gestures and its local form state. It places transitions as either door or stair using the same shared surface and stair-draft authoring seams as connection editing. Selected targets stay as `DungeonTransitionDestination`, not split enum/id fields.
- `RoomNarrationPane` owns narration editing UI for the current selection. Tool code should not re-embed that form logic.
- `CellWindowDragSession` is the shared rectangular drag-window helper for paint-style tools. Keep gesture meaning on the concrete tools instead of lifting room/floor semantics into the shared helper.

## Selection Semantics

- Selection identity is semantic. Compare typed owner refs from `DungeonSelectionRef` instead of reconstructing owners from generic ids.
