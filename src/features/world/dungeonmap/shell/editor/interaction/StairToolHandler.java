package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.canvas.base.DungeonCanvasPointerEvent;
import features.world.dungeonmap.shell.editor.DungeonEditorTool;
import features.world.dungeonmap.state.DungeonMapState;
import features.world.dungeonmap.state.DungeonStairDraftState;
import javafx.scene.Node;

import java.util.Objects;
import java.util.Set;

public final class StairToolHandler implements EditorToolHandler {

    private final StairInteractionController controller;
    private final DungeonMapState mapState;
    private final DungeonStairDraftState stairDraftState;

    private DungeonEditorTool activeTool;
    private Runnable refreshCallback;

    public StairToolHandler(
            StairInteractionController controller,
            DungeonMapState mapState,
            DungeonStairDraftState stairDraftState
    ) {
        this.controller = Objects.requireNonNull(controller, "controller");
        this.mapState = Objects.requireNonNull(mapState, "mapState");
        this.stairDraftState = Objects.requireNonNull(stairDraftState, "stairDraftState");
    }

    @Override
    public Set<DungeonEditorTool> supportedTools() {
        return Set.of(DungeonEditorTool.STAIR_CREATE, DungeonEditorTool.STAIR_DELETE);
    }

    @Override
    public void activate(DungeonEditorTool tool) {
        activeTool = tool;
        if (tool == DungeonEditorTool.STAIR_CREATE) {
            stairDraftState.resetForLevel(mapState.activeProjectionLevel());
        }
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
