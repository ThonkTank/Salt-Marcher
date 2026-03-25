package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.canvas.base.DungeonCanvasPointerEvent;
import features.world.dungeonmap.shell.editor.DungeonEditorTool;
import features.world.dungeonmap.state.DungeonCorridorDraftState;
import javafx.scene.Node;

import java.util.Objects;
import java.util.Set;

public final class CorridorToolHandler implements EditorToolHandler {

    private final CorridorInteractionController controller;
    private final DungeonCorridorDraftState corridorDraftState;

    private DungeonEditorTool activeTool;
    private Runnable refreshCallback;

    public CorridorToolHandler(
            CorridorInteractionController controller,
            DungeonCorridorDraftState corridorDraftState
    ) {
        this.controller = Objects.requireNonNull(controller, "controller");
        this.corridorDraftState = Objects.requireNonNull(corridorDraftState, "corridorDraftState");
    }

    @Override
    public Set<DungeonEditorTool> supportedTools() {
        return Set.of(DungeonEditorTool.CORRIDOR_CREATE, DungeonEditorTool.CORRIDOR_DELETE);
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
