package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.canvas.base.DungeonCanvasPointerEvent;
import features.world.dungeonmap.shell.editor.DungeonEditorTool;
import features.world.dungeonmap.state.DungeonStairDraftState;
import javafx.scene.Node;

import java.util.Objects;
import java.util.Set;

public final class StairToolHandler implements EditorToolHandler {

    private final StairInteractionController controller;
    private final DungeonStairDraftState stairDraftState;

    private DungeonEditorTool activeTool;
    private Runnable refreshCallback;

    public StairToolHandler(
            StairInteractionController controller,
            DungeonStairDraftState stairDraftState
    ) {
        this.controller = Objects.requireNonNull(controller, "controller");
        this.stairDraftState = Objects.requireNonNull(stairDraftState, "stairDraftState");
    }

    @Override
    public Set<DungeonEditorTool> supportedTools() {
        return Set.of(DungeonEditorTool.STAIR_CREATE, DungeonEditorTool.STAIR_DELETE);
    }

    @Override
    public void activate(DungeonEditorTool tool) {
        activeTool = tool;
    }

    @Override
    public void deactivate() {
        stairDraftState.clear();
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
