package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.canvas.base.DungeonCanvasPointerEvent;
import features.world.dungeonmap.shell.editor.DungeonEditorTool;
import features.world.dungeonmap.state.DungeonBoundaryDraftState;
import javafx.scene.Node;

import java.util.Objects;
import java.util.Set;

public final class BoundaryToolHandler implements EditorToolHandler {

    private final BoundaryInteractionController controller;
    private final DungeonBoundaryDraftState boundaryDraftState;

    private DungeonEditorTool activeTool;
    private Runnable refreshCallback;

    public BoundaryToolHandler(
            BoundaryInteractionController controller,
            DungeonBoundaryDraftState boundaryDraftState
    ) {
        this.controller = Objects.requireNonNull(controller, "controller");
        this.boundaryDraftState = Objects.requireNonNull(boundaryDraftState, "boundaryDraftState");
    }

    @Override
    public Set<DungeonEditorTool> supportedTools() {
        return Set.of(
                DungeonEditorTool.CLUSTER_WALL,
                DungeonEditorTool.CLUSTER_WALL_DELETE,
                DungeonEditorTool.CLUSTER_DOOR,
                DungeonEditorTool.CLUSTER_DOOR_DELETE);
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
