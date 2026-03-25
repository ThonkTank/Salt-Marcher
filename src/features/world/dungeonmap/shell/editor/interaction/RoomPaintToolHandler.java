package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.canvas.base.DungeonCanvasPointerEvent;
import features.world.dungeonmap.shell.editor.DungeonEditorTool;
import features.world.dungeonmap.state.EditorPaintPreviewState;
import javafx.scene.Node;

import java.util.Objects;
import java.util.Set;

public final class RoomPaintToolHandler implements EditorToolHandler {

    private final RoomPaintInteractionController controller;
    private final EditorPaintPreviewState paintPreviewState;

    private DungeonEditorTool activeTool;
    private Runnable refreshCallback;

    public RoomPaintToolHandler(
            RoomPaintInteractionController controller,
            EditorPaintPreviewState paintPreviewState
    ) {
        this.controller = Objects.requireNonNull(controller, "controller");
        this.paintPreviewState = Objects.requireNonNull(paintPreviewState, "paintPreviewState");
    }

    @Override
    public Set<DungeonEditorTool> supportedTools() {
        return Set.of(DungeonEditorTool.ROOM_PAINT, DungeonEditorTool.ROOM_DELETE);
    }

    @Override
    public void activate(DungeonEditorTool tool) {
        activeTool = tool;
    }

    @Override
    public void deactivate() {
        controller.clear();
    }

    @Override
    public boolean handlePressed(DungeonCanvasPointerEvent event) {
        return controller.handlePressed(event);
    }

    @Override
    public boolean handleDragged(DungeonCanvasPointerEvent event) {
        return controller.handleDragged(event);
    }

    @Override
    public boolean handleReleased(DungeonCanvasPointerEvent event) {
        return controller.handleReleased(event);
    }

    @Override
    public Node statePaneContent() {
        return null;
    }

    @Override
    public void setRefreshCallback(Runnable callback) {
        refreshCallback = callback;
    }
}
