package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.application.room.DungeonBoundaryEditService;
import features.world.dungeonmap.canvas.base.DungeonCanvasPointerEvent;
import features.world.dungeonmap.loading.DungeonMapLoadingService;
import features.world.dungeonmap.model.structures.cluster.InternalBoundaryType;
import features.world.dungeonmap.shell.editor.DungeonEditorTool;
import features.world.dungeonmap.state.DungeonEditorSessionState;
import features.world.dungeonmap.state.DungeonMapState;
import features.world.dungeonmap.state.EditorSelectionState;
import ui.async.UiAsyncTasks;
import ui.async.UiErrorReporter;

import java.util.Objects;

public final class BoundaryInteractionController {

    private final DungeonMapState mapState;
    private final DungeonMapLoadingService loadingService;
    private final DungeonEditorSessionState sessionState;
    private final EditorSelectionState selectionState;
    private final DungeonBoundaryEditService boundaryEditService;
    private final DungeonGridBoundaryHitTester hitTester = new DungeonGridBoundaryHitTester();

    public BoundaryInteractionController(
            DungeonMapState mapState,
            DungeonMapLoadingService loadingService,
            DungeonEditorSessionState sessionState,
            EditorSelectionState selectionState,
            DungeonBoundaryEditService boundaryEditService
    ) {
        this.mapState = Objects.requireNonNull(mapState, "mapState");
        this.loadingService = Objects.requireNonNull(loadingService, "loadingService");
        this.sessionState = Objects.requireNonNull(sessionState, "sessionState");
        this.selectionState = Objects.requireNonNull(selectionState, "selectionState");
        this.boundaryEditService = Objects.requireNonNull(boundaryEditService, "boundaryEditService");
    }

    public boolean handlePressed(DungeonCanvasPointerEvent event) {
        if (event == null || !event.isPrimaryButton()) {
            return false;
        }
        DungeonEditorTool tool = sessionState.selectedTool();
        if (!tool.isWallTool() && !tool.isDoorTool()) {
            return false;
        }
        DungeonEditorBoundaryHitTarget hit = hitTester.hitTest(mapState.activeMap(), event.canvasPoint(), event.camera());
        if (hit == null || hit.targetRef().clusterId() == null) {
            selectionState.clearSelection();
            return false;
        }
        selectionState.selectTarget(hit.targetKey());
        Long mapId = mapState.activeMapId();
        if (mapId == null) {
            return true;
        }
        boolean deleteBoundary = tool == DungeonEditorTool.CLUSTER_WALL_DELETE || tool == DungeonEditorTool.CLUSTER_DOOR_DELETE;
        InternalBoundaryType type = tool.isDoorTool() ? InternalBoundaryType.DOOR : InternalBoundaryType.WALL;
        UiAsyncTasks.submitVoid(
                () -> boundaryEditService.apply(mapId, hit.targetRef().clusterId(), hit.edge(), type, deleteBoundary),
                () -> loadingService.reload(mapId),
                throwable -> UiErrorReporter.reportBackgroundFailure("BoundaryInteractionController.handlePressed()", throwable));
        return true;
    }

    public boolean handleDragged(DungeonCanvasPointerEvent event) {
        return false;
    }

    public boolean handleReleased(DungeonCanvasPointerEvent event) {
        return false;
    }

    public void clear() {
    }
}
