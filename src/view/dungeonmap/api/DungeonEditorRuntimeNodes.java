package src.view.dungeonmap.api;

import java.util.Objects;
import java.util.function.Supplier;
import javafx.scene.Node;
import src.view.dungeonmap.api.internal.DungeonEditorInteractor;

public final class DungeonEditorRuntimeNodes {

    private final Supplier<Node> controls;
    private final Supplier<Node> workspace;
    private final Supplier<Node> state;

    private DungeonEditorRuntimeNodes(Supplier<Node> controls, Supplier<Node> workspace, Supplier<Node> state) {
        this.controls = Objects.requireNonNull(controls, "controls");
        this.workspace = Objects.requireNonNull(workspace, "workspace");
        this.state = Objects.requireNonNull(state, "state");
    }

    public static DungeonEditorRuntimeNodes create(DungeonSelectionPublisher selectionPublisher) {
        return create(
                selectionPublisher,
                DungeonControlsExtensions.empty(),
                DungeonMapCanvasExtensions.empty());
    }

    public static DungeonEditorRuntimeNodes create(
            DungeonSelectionPublisher selectionPublisher,
            DungeonControlsExtensions controlsExtensions,
            DungeonMapCanvasExtensions canvasExtensions
    ) {
        DungeonEditorInteractor interactor =
                new DungeonEditorInteractor(Objects.requireNonNull(selectionPublisher, "selectionPublisher"));
        interactor.applyExtensions(
                Objects.requireNonNull(controlsExtensions, "controlsExtensions"),
                Objects.requireNonNull(canvasExtensions, "canvasExtensions"));
        return new DungeonEditorRuntimeNodes(interactor::controls, interactor::workspaceNode, interactor::state);
    }

    public Node controls() {
        return Objects.requireNonNull(controls.get(), "controls");
    }

    public Node workspace() {
        return Objects.requireNonNull(workspace.get(), "workspace");
    }

    public Node state() {
        return Objects.requireNonNull(state.get(), "state");
    }
}
