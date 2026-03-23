package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.application.stair.DungeonStairEditService;
import features.world.dungeonmap.canvas.base.DungeonCanvasPointerEvent;
import features.world.dungeonmap.loading.DungeonMapLoadingService;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.structures.stair.DungeonStair;
import features.world.dungeonmap.shell.editor.DungeonEditorTool;
import features.world.dungeonmap.state.DungeonEditorSessionState;
import features.world.dungeonmap.state.DungeonMapState;
import features.world.dungeonmap.state.DungeonStairDraftState;
import features.world.dungeonmap.state.EditorSelectionState;
import ui.async.UiAsyncTasks;
import ui.async.UiErrorReporter;

import java.util.Comparator;
import java.util.Objects;

public final class StairInteractionController {

    private final DungeonMapState mapState;
    private final DungeonMapLoadingService loadingService;
    private final DungeonEditorSessionState sessionState;
    private final EditorSelectionState selectionState;
    private final DungeonStairDraftState stairDraftState;
    private final DungeonStairEditService stairEditService;

    public StairInteractionController(
            DungeonMapState mapState,
            DungeonMapLoadingService loadingService,
            DungeonEditorSessionState sessionState,
            EditorSelectionState selectionState,
            DungeonStairDraftState stairDraftState,
            DungeonStairEditService stairEditService
    ) {
        this.mapState = Objects.requireNonNull(mapState, "mapState");
        this.loadingService = Objects.requireNonNull(loadingService, "loadingService");
        this.sessionState = Objects.requireNonNull(sessionState, "sessionState");
        this.selectionState = Objects.requireNonNull(selectionState, "selectionState");
        this.stairDraftState = Objects.requireNonNull(stairDraftState, "stairDraftState");
        this.stairEditService = Objects.requireNonNull(stairEditService, "stairEditService");
    }

    public boolean handlePressed(DungeonCanvasPointerEvent event) {
        if (event == null || !event.isPrimaryButton()) {
            return false;
        }
        return switch (sessionState.selectedTool()) {
            case STAIR_CREATE -> handleCreatePressed(event.gridCell());
            case STAIR_DELETE -> handleDeletePressed(event.gridCell());
            default -> false;
        };
    }

    public boolean handleDragged(DungeonCanvasPointerEvent event) {
        return false;
    }

    public boolean handleReleased(DungeonCanvasPointerEvent event) {
        return false;
    }

    public void clear() {
        if (sessionState.selectedTool() != DungeonEditorTool.STAIR_CREATE) {
            stairDraftState.clear();
        }
    }

    public void saveDraft() {
        Long mapId = mapState.activeMapId();
        if (mapId == null) {
            return;
        }
        var draftNodes = stairDraftState.pathNodes();
        UiAsyncTasks.submitVoid(
                () -> stairEditService.create(mapState.activeMap(), draftNodes),
                () -> {
                    stairDraftState.clear();
                    loadingService.reload(mapId);
                },
                throwable -> UiErrorReporter.reportBackgroundFailure("StairInteractionController.saveDraft()", throwable));
    }

    private boolean handleCreatePressed(Point2i gridCell) {
        if (gridCell == null) {
            return false;
        }
        CubePoint node = CubePoint.at(gridCell, mapState.activeProjectionLevel());
        stairDraftState.append(node);
        selectionState.clearSelection();
        return true;
    }

    private boolean handleDeletePressed(Point2i gridCell) {
        Long mapId = mapState.activeMapId();
        if (mapId == null || gridCell == null) {
            return false;
        }
        DungeonStair stair = mapState.activeMap().stairsAtCell(gridCell, mapState.activeProjectionLevel()).stream()
                .filter(candidate -> candidate != null && candidate.stairId() != null)
                .min(Comparator.comparing(DungeonStair::stairId))
                .orElse(null);
        if (stair == null || stair.stairId() == null) {
            selectionState.clearSelection();
            return false;
        }
        selectionState.selectTarget(stair.targetKey());
        UiAsyncTasks.submitVoid(
                () -> stairEditService.delete(stair.stairId()),
                () -> loadingService.reload(mapId),
                throwable -> UiErrorReporter.reportBackgroundFailure("StairInteractionController.handleDeletePressed()", throwable));
        return true;
    }
}
