package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.canvas.base.DungeonCanvasPointerEvent;
import features.world.dungeonmap.shell.editor.DungeonEditorTool;
import features.world.dungeonmap.state.DungeonTransitionDraftState;
import javafx.scene.Node;

import java.util.Objects;
import java.util.Set;

public final class TransitionToolHandler implements EditorToolHandler {

    private final TransitionInteractionController controller;
    private final DungeonTransitionDraftState transitionDraftState;

    private DungeonEditorTool activeTool;
    private Runnable refreshCallback;

    public TransitionToolHandler(
            TransitionInteractionController controller,
            DungeonTransitionDraftState transitionDraftState
    ) {
        this.controller = Objects.requireNonNull(controller, "controller");
        this.transitionDraftState = Objects.requireNonNull(transitionDraftState, "transitionDraftState");
    }

    @Override
    public Set<DungeonEditorTool> supportedTools() {
        return Set.of(DungeonEditorTool.TRANSITION_CREATE, DungeonEditorTool.TRANSITION_DELETE);
    }

    @Override
    public void activate(DungeonEditorTool tool) {
        activeTool = tool;
    }

    @Override
    public void deactivate() {
        transitionDraftState.clearPlacementError();
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
