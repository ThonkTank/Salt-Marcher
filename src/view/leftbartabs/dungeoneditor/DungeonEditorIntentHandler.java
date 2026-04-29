package src.view.leftbartabs.dungeoneditor;

import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import org.jspecify.annotations.Nullable;

final class DungeonEditorIntentHandler {

    private final DungeonEditorContributionModel contributionModel;
    private Consumer<DungeonEditorPublishedEvent> publishedEventListener = ignored -> {};

    DungeonEditorIntentHandler(DungeonEditorContributionModel contributionModel) {
        this.contributionModel = Objects.requireNonNull(contributionModel, "contributionModel");
    }

    void onPublishedEventRequested(Consumer<DungeonEditorPublishedEvent> listener) {
        publishedEventListener = listener == null ? ignored -> {} : listener;
    }

    void consume(DungeonEditorMainViewInputEvent event) {
        if (event == null) {
            return;
        }
        switch (event.kind()) {
            case POINTER_PRESSED -> {
                DungeonEditorContributionModel.InteractionResult result =
                        contributionModel.primaryPressed(contributionModel.resolvePointerState(
                                event.canvasX(),
                                event.canvasY(),
                                event.primaryButtonDown(),
                                event.secondaryButtonDown(),
                                event.hitRef()));
                dispatchNullable(result.action());
            }
            case POINTER_DRAGGED -> {
                dispatchNullable(contributionModel.primaryDragged(contributionModel.resolvePointerState(
                        event.canvasX(),
                        event.canvasY(),
                        event.primaryButtonDown(),
                        event.secondaryButtonDown(),
                        event.hitRef())));
            }
            case POINTER_RELEASED -> {
                dispatchNullable(contributionModel.primaryReleased(contributionModel.resolvePointerState(
                        event.canvasX(),
                        event.canvasY(),
                        event.primaryButtonDown(),
                        event.secondaryButtonDown(),
                        event.hitRef())));
            }
            case POINTER_MOVED -> {
                contributionModel.pointerMoved(contributionModel.resolvePointerState(
                        event.canvasX(),
                        event.canvasY(),
                        event.primaryButtonDown(),
                        event.secondaryButtonDown(),
                        event.hitRef()));
            }
            case LEVEL_SCROLLED -> {
                dispatchNullable(contributionModel.levelScrolled(event.levelDelta()));
            }
        }
    }

    void consume(DungeonEditorControlsViewInputEvent event) {
        if (event == null) {
            return;
        }
        switch (event.kind()) {
            case REFRESH -> dispatch(contributionModel.refresh());
            case SELECT_MAP -> dispatchNullable(contributionModel.selectMap(event.mapKey()));
            case CREATE_MAP -> dispatch(contributionModel.createMap(event.mapName()));
            case RENAME_MAP -> dispatchNullable(contributionModel.renameMap(event.mapKey(), event.mapName()));
            case DELETE_MAP -> dispatchNullable(contributionModel.deleteMap(event.mapKey()));
            case SELECT_VIEW_MODE -> contributionModel.selectViewMode(event.viewModeKey());
            case SELECT_TOOL -> contributionModel.selectTool(event.tool());
            case PREVIOUS_LEVEL -> dispatchNullable(contributionModel.previousLevel());
            case NEXT_LEVEL -> dispatchNullable(contributionModel.nextLevel());
            case OVERLAY_MODE_CHANGED -> contributionModel.selectOverlayMode(event.viewModeKey());
            case OVERLAY_RANGE_CHANGED -> contributionModel.selectOverlayRange(event.overlayRange());
            case OVERLAY_OPACITY_CHANGED -> contributionModel.selectOverlayOpacity(event.overlayOpacity());
            case OVERLAY_LEVELS_CHANGED -> contributionModel.selectOverlayLevels(event.overlayLevels());
            default -> {
            }
        }
    }

    void consume(DungeonEditorStateViewInputEvent event) {
        if (event == null) {
            return;
        }
        saveRoomNarration(
                event.roomId(),
                event.visualDescription(),
                event.exits().stream()
                        .map(exit -> new DungeonEditorContributionModel.RoomExitNarrationData(
                                exit.label(),
                                exit.q(),
                                exit.r(),
                                exit.level(),
                                exit.direction(),
                                exit.description()))
                        .toList());
    }

    private void saveRoomNarration(
            long roomId,
            String visualDescription,
            List<DungeonEditorContributionModel.RoomExitNarrationData> exits
    ) {
        dispatchNullable(contributionModel.saveRoomNarration(roomId, visualDescription, exits));
    }

    private void dispatchNullable(@Nullable Object actionCandidate) {
        if (!(actionCandidate instanceof DungeonEditorContributionModel.ActionPlan action)) {
            return;
        }
        dispatch(action);
    }

    private void dispatch(DungeonEditorContributionModel.ActionPlan action) {
        DungeonEditorContributionModel.ActionDispatch dispatch = contributionModel.toDispatch(action);
        if (dispatch == null) {
            return;
        }
        publishedEventListener.accept(toPublishedEvent(dispatch));
    }

    private static DungeonEditorPublishedEvent toPublishedEvent(
            DungeonEditorContributionModel.ActionDispatch dispatch
    ) {
        DungeonEditorContributionModel.ActionDispatch safeDispatch = dispatch == null
                ? DungeonEditorContributionModel.ActionDispatch.loadEditor(0L, 0, "GRID")
                : dispatch;
        return switch (safeDispatch.kind()) {
            case LOAD_EDITOR -> DungeonEditorPublishedEvent.loadEditor(
                    safeDispatch.mapId(),
                    safeDispatch.projectionLevel(),
                    safeDispatch.viewModeKey());
            case CREATE_MAP -> DungeonEditorPublishedEvent.createMap(safeDispatch.mapName());
            case RENAME_MAP -> DungeonEditorPublishedEvent.renameMap(safeDispatch.mapId(), safeDispatch.mapName());
            case DELETE_MAP -> DungeonEditorPublishedEvent.deleteMap(safeDispatch.mapId());
            case PREVIEW_SURFACE_EDIT -> DungeonEditorPublishedEvent.previewSurfaceEdit(
                    safeDispatch.mapId(),
                    toPublishedMutation(safeDispatch.mutation()));
            case APPLY_SURFACE_EDIT -> DungeonEditorPublishedEvent.applySurfaceEdit(
                    safeDispatch.mapId(),
                    toPublishedMutation(safeDispatch.mutation()));
            case LOAD_SURFACE -> DungeonEditorPublishedEvent.loadSurface(
                    safeDispatch.mapId(),
                    new DungeonEditorPublishedEvent.InspectorSelection(
                            safeDispatch.inspectorSelection().topologyRefKind(),
                            safeDispatch.inspectorSelection().topologyRefId(),
                            safeDispatch.inspectorSelection().clusterId(),
                            safeDispatch.inspectorSelection().clusterSelection(),
                            safeDispatch.inspectorSelection().surfaceKind()));
        };
    }

    private static DungeonEditorPublishedEvent.Mutation toPublishedMutation(
            DungeonEditorContributionModel.ActionDispatch.Mutation mutation
    ) {
        DungeonEditorContributionModel.ActionDispatch.Mutation safeMutation = mutation == null
                ? DungeonEditorContributionModel.ActionDispatch.Mutation.none()
                : mutation;
        return switch (safeMutation) {
            case DungeonEditorContributionModel.ActionDispatch.NoneMutation ignored ->
                    DungeonEditorPublishedEvent.Mutation.none();
            case DungeonEditorContributionModel.ActionDispatch.RoomRectangleMutation room ->
                    new DungeonEditorPublishedEvent.RoomRectangleMutation(
                            toPublishedCell(room.start()),
                            toPublishedCell(room.end()),
                            room.deleteMode());
            case DungeonEditorContributionModel.ActionDispatch.ClusterBoundariesMutation boundaries ->
                    new DungeonEditorPublishedEvent.ClusterBoundariesMutation(
                            boundaries.clusterId(),
                            boundaries.edges().stream().map(DungeonEditorIntentHandler::toPublishedEdge).toList(),
                            boundaries.boundaryKind(),
                            boundaries.deleteMode());
            case DungeonEditorContributionModel.ActionDispatch.SaveRoomNarrationMutation narration ->
                    new DungeonEditorPublishedEvent.SaveRoomNarrationMutation(
                            narration.roomId(),
                            narration.visualDescription(),
                            narration.exits().stream().map(DungeonEditorIntentHandler::toPublishedExit).toList());
            case DungeonEditorContributionModel.ActionDispatch.MoveHandleMutation moveHandle ->
                    new DungeonEditorPublishedEvent.MoveHandleMutation(
                            toPublishedHandle(moveHandle.handleRef()),
                            moveHandle.deltaQ(),
                            moveHandle.deltaR(),
                            moveHandle.deltaLevel());
            case DungeonEditorContributionModel.ActionDispatch.MoveBoundaryStretchMutation stretch ->
                    new DungeonEditorPublishedEvent.MoveBoundaryStretchMutation(
                            stretch.clusterId(),
                            stretch.sourceEdges().stream().map(DungeonEditorIntentHandler::toPublishedEdge).toList(),
                            stretch.deltaQ(),
                            stretch.deltaR(),
                            stretch.deltaLevel());
        };
    }

    private static DungeonEditorPublishedEvent.CellRef toPublishedCell(
            DungeonEditorContributionModel.ActionDispatch.CellRef cell
    ) {
        DungeonEditorContributionModel.ActionDispatch.CellRef safeCell = cell == null
                ? DungeonEditorContributionModel.ActionDispatch.CellRef.empty()
                : cell;
        return new DungeonEditorPublishedEvent.CellRef(safeCell.q(), safeCell.r(), safeCell.level());
    }

    private static DungeonEditorPublishedEvent.EdgeRef toPublishedEdge(
            DungeonEditorContributionModel.ActionDispatch.EdgeRef edge
    ) {
        DungeonEditorContributionModel.ActionDispatch.EdgeRef safeEdge = edge == null
                ? new DungeonEditorContributionModel.ActionDispatch.EdgeRef(
                DungeonEditorContributionModel.ActionDispatch.CellRef.empty(),
                DungeonEditorContributionModel.ActionDispatch.CellRef.empty())
                : edge;
        return new DungeonEditorPublishedEvent.EdgeRef(
                toPublishedCell(safeEdge.from()),
                toPublishedCell(safeEdge.to()));
    }

    private static DungeonEditorPublishedEvent.HandleRef toPublishedHandle(
            DungeonEditorContributionModel.ActionDispatch.HandleRef handleRef
    ) {
        DungeonEditorContributionModel.ActionDispatch.HandleRef safeHandle = handleRef == null
                ? DungeonEditorContributionModel.ActionDispatch.HandleRef.empty()
                : handleRef;
        return new DungeonEditorPublishedEvent.HandleRef(
                safeHandle.kind(),
                safeHandle.topologyRefKind(),
                safeHandle.topologyRefId(),
                safeHandle.ownerId(),
                safeHandle.clusterId(),
                safeHandle.corridorId(),
                safeHandle.roomId(),
                safeHandle.index(),
                toPublishedCell(safeHandle.cell()),
                safeHandle.direction());
    }

    private static DungeonEditorPublishedEvent.RoomExitNarration toPublishedExit(
            DungeonEditorContributionModel.ActionDispatch.RoomExitNarration exit
    ) {
        DungeonEditorContributionModel.ActionDispatch.RoomExitNarration safeExit = exit == null
                ? new DungeonEditorContributionModel.ActionDispatch.RoomExitNarration(
                "",
                DungeonEditorContributionModel.ActionDispatch.CellRef.empty(),
                "",
                "")
                : exit;
        return new DungeonEditorPublishedEvent.RoomExitNarration(
                safeExit.label(),
                toPublishedCell(safeExit.cell()),
                safeExit.direction(),
                safeExit.description());
    }
}
