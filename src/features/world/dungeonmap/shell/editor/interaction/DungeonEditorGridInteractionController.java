package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.canvas.base.DungeonCanvasInteractionHandler;
import features.world.dungeonmap.canvas.base.DungeonCanvasPointerEvent;
import features.world.dungeonmap.canvas.base.DungeonViewMode;
import features.world.dungeonmap.shell.editor.DungeonEditorTool;
import features.world.dungeonmap.state.DungeonEditorSessionState;
import features.world.dungeonmap.state.DungeonMapState;

import java.util.Objects;

public final class DungeonEditorGridInteractionController implements DungeonCanvasInteractionHandler {

    private final DungeonMapState mapState;
    private final DungeonEditorSessionState sessionState;
    private final ClusterSelectionDragController clusterSelectionDragController;
    private final RoomPaintInteractionController roomPaintInteractionController;

    public DungeonEditorGridInteractionController(
            DungeonMapState mapState,
            DungeonEditorSessionState sessionState,
            ClusterSelectionDragController clusterSelectionDragController,
            RoomPaintInteractionController roomPaintInteractionController
    ) {
        this.mapState = Objects.requireNonNull(mapState, "mapState");
        this.sessionState = Objects.requireNonNull(sessionState, "sessionState");
        this.clusterSelectionDragController = Objects.requireNonNull(clusterSelectionDragController, "clusterSelectionDragController");
        this.roomPaintInteractionController = Objects.requireNonNull(roomPaintInteractionController, "roomPaintInteractionController");
    }

    @Override
    public boolean handlePressed(DungeonCanvasPointerEvent event) {
        if (!interactionEnabled()) {
            clear();
            return false;
        }
        if (sessionState.selectedTool().isRoomTool()) {
            clusterSelectionDragController.clear();
            return roomPaintInteractionController.handlePressed(event);
        }
        if (sessionState.selectedTool() != DungeonEditorTool.SELECT) {
            clear();
            return false;
        }
        roomPaintInteractionController.clear();
        return clusterSelectionDragController.handlePressed(event);
    }

    @Override
    public boolean handleDragged(DungeonCanvasPointerEvent event) {
        if (sessionState.selectedTool().isRoomTool()) {
            return roomPaintInteractionController.handleDragged(event);
        }
        if (!interactionEnabled() || sessionState.selectedTool() != DungeonEditorTool.SELECT) {
            return false;
        }
        return clusterSelectionDragController.handleDragged(event);
    }

    @Override
    public boolean handleReleased(DungeonCanvasPointerEvent event) {
        if (sessionState.selectedTool().isRoomTool()) {
            return roomPaintInteractionController.handleReleased(event);
        }
        if (sessionState.selectedTool() != DungeonEditorTool.SELECT) {
            return false;
        }
        return clusterSelectionDragController.handleReleased(event);
    }

    public void clear() {
        clusterSelectionDragController.clear();
        roomPaintInteractionController.clear();
    }

    private boolean interactionEnabled() {
        return sessionState.viewMode() == DungeonViewMode.GRID && !mapState.loading();
    }
}
