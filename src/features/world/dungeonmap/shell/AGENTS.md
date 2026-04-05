# AGENTS.md

This file covers `src/features/world/dungeonmap/shell/`.
Use it together with the parent `dungeonmap/AGENTS.md` and the repository root `AGENTS.md`.
For editor tool responsibilities, also read `shell/editor/interaction/AGENTS.md` when working in that subtree.

## View Boundary

- `AbstractDungeonMapView` owns the shared shell lifecycle around the view-local `DungeonCanvasWorkspace`.
- `DungeonEditorView` and `DungeonRuntimeView` are shell wiring over shared state and application services. Do not move canonical workflow state into view-local mirrors.

## Shared Interaction Seams

- `DungeonHitCollector` owns raw hit candidates. `DungeonHitSnapshot` is the shared event-time selection surface.
- `DungeonHitProbe` carries canonical `CellCoord` cell context plus canonical `GridPoint2x` probe geometry.
- Cell hits use `DungeonHitSurface.CellSurface`. Half-step geometry uses `PointSurface` and `SegmentSurface`.
- `DungeonHitKind` and `DungeonSelectionRef` come from `model/interaction/`. Shell code consumes them and must not redefine owner semantics.
- Internal wall hits resolve through `RoomBoundaryRef`. Tools that need cluster context derive it from `DungeonLayout.describeRoomBoundary(...)`.
- Free corridor wall hits resolve through `CorridorBoundaryRef`. Tools that need the touched corridor cell derive it from `DungeonLayout.describeCorridorBoundary(...)`.
- `DungeonSelectionHighlightResolver` is the shared shell seam that turns `DungeonSelectionRef` into generic `DungeonHitSurface` overlays for editor hover rendering.

## Shared State Boundaries

- `EditorInteractionState` owns only shared editor coordination state: selected ref, explicit hover intent, and active preview.
- `DungeonEditorSessionState` owns the selected tool and active view mode. Tool-private transient state stays on the tool.
- `EditorHover` is explicit render intent: `OWNER` highlights the owning target, `PART` highlights the concrete part.
- `DungeonMapState` owns loaded map/catalog data, projection level, overlay settings, loading flags, and mutation-pending state.
- `DungeonRuntimeState` owns persisted, preview, and pending navigation snapshots plus runtime loading/dragging/moving/error flags.
- Preview is never commit state. Successful writes reload authoritative data instead of repairing partial shell semantics.

## Runtime UI

- `DungeonRuntimeInteractionController` owns drag-to-move: press begins only when the active cell is selected, drag shows preview, and release commits the move.
- `DungeonRuntimeSelectionPolicy` chooses the first runtime-selectable subject that actually owns the active cell. Runtime interaction is not driven by the top raw hit candidate alone.
- `DungeonRuntimeView` resolves one shared `DungeonRuntimeLocation` per refresh pass, then branches into read-only description and executable action assembly. Do not rebuild layout parsing separately for overlay, inspector, and travel sinks.
- Runtime details are published through the shared `DetailsNavigator`. Do not add a parallel feature-local runtime details pane.
- Cross-map continuation lives in shared pending navigation snapshot state, not in a runtime view-local copy.
