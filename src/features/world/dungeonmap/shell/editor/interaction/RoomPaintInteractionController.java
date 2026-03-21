package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.application.room.DungeonRoomEditService;
import features.world.dungeonmap.canvas.base.DungeonCanvasPointerEvent;
import features.world.dungeonmap.loading.DungeonMapLoadingService;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.TileShape;
import features.world.dungeonmap.shell.editor.DungeonEditorTool;
import features.world.dungeonmap.state.DungeonEditorSessionState;
import features.world.dungeonmap.state.EditorPaintPreviewState;
import features.world.dungeonmap.state.EditorSelectionState;
import features.world.dungeonmap.state.DungeonMapState;
import ui.async.UiAsyncTasks;
import ui.async.UiErrorReporter;

import java.util.Objects;

public final class RoomPaintInteractionController {

    private final DungeonMapState mapState;
    private final DungeonMapLoadingService loadingService;
    private final DungeonEditorSessionState sessionState;
    private final EditorSelectionState selectionState;
    private final EditorPaintPreviewState paintPreviewState;
    private final DungeonRoomEditService roomEditService;

    private RoomPaintSession paintSession;

    public RoomPaintInteractionController(
            DungeonMapState mapState,
            DungeonMapLoadingService loadingService,
            DungeonEditorSessionState sessionState,
            EditorSelectionState selectionState,
            EditorPaintPreviewState paintPreviewState,
            DungeonRoomEditService roomEditService
    ) {
        this.mapState = Objects.requireNonNull(mapState, "mapState");
        this.loadingService = Objects.requireNonNull(loadingService, "loadingService");
        this.sessionState = Objects.requireNonNull(sessionState, "sessionState");
        this.selectionState = Objects.requireNonNull(selectionState, "selectionState");
        this.paintPreviewState = Objects.requireNonNull(paintPreviewState, "paintPreviewState");
        this.roomEditService = Objects.requireNonNull(roomEditService, "roomEditService");
    }

    public boolean handlePressed(DungeonCanvasPointerEvent event) {
        if (event == null || !event.isPrimaryButton()) {
            clear();
            return false;
        }
        Point2i cell = event == null ? null : event.gridCell();
        if (cell == null || !sessionState.selectedTool().isRoomTool()) {
            clear();
            return false;
        }
        selectionState.clearSelection();
        paintSession = new RoomPaintSession(cell, cell, sessionState.selectedTool() == DungeonEditorTool.ROOM_DELETE);
        paintPreviewState.showPreview(paintSession.previewShape(), paintSession.deleteMode());
        return true;
    }

    public boolean handleDragged(DungeonCanvasPointerEvent event) {
        if (event == null || !event.isPrimaryButtonDown()) {
            return false;
        }
        Point2i cell = event == null ? null : event.gridCell();
        if (paintSession == null || cell == null || !sessionState.selectedTool().isRoomTool()) {
            return false;
        }
        if (Objects.equals(paintSession.endCell(), cell)) {
            return true;
        }
        paintSession = paintSession.withEndCell(cell);
        paintPreviewState.showPreview(paintSession.previewShape(), paintSession.deleteMode());
        return true;
    }

    public boolean handleReleased(DungeonCanvasPointerEvent event) {
        if (event == null) {
            return false;
        }
        Point2i cell = event == null ? null : event.gridCell();
        if (paintSession == null || cell == null) {
            return false;
        }
        RoomPaintSession finishedSession = paintSession.withEndCell(cell);
        TileShape shape = finishedSession.previewShape();
        clear();
        Long mapId = mapState.activeMapId();
        if (mapId == null || shape.size() == 0) {
            return true;
        }
        UiAsyncTasks.submitVoid(
                () -> {
                    if (finishedSession.deleteMode()) {
                        roomEditService.delete(mapId, shape);
                    } else {
                        roomEditService.paint(mapId, shape);
                    }
                },
                () -> loadingService.reload(mapId),
                throwable -> UiErrorReporter.reportBackgroundFailure("RoomPaintInteractionController.handleReleased()", throwable));
        return true;
    }

    public void clear() {
        paintSession = null;
        paintPreviewState.clearPreview();
    }
}
