package src.view.dungeonshared.api;

import java.util.Objects;
import javafx.scene.Node;
import src.view.dungeonshared.assembly.DungeonEditorInteractor;

public final class DungeonEditorRuntimeNodes {

    private final Node controls;
    private final Node workspace;
    private final Node state;

    private DungeonEditorRuntimeNodes(Node controls, Node workspace, Node state) {
        this.controls = Objects.requireNonNull(controls, "controls");
        this.workspace = Objects.requireNonNull(workspace, "workspace");
        this.state = Objects.requireNonNull(state, "state");
    }

    public static DungeonEditorRuntimeNodes create(DungeonSelectionPublisher selectionPublisher) {
        DungeonEditorInteractor interactor =
                new DungeonEditorInteractor(Objects.requireNonNull(selectionPublisher, "selectionPublisher"));
        return new DungeonEditorRuntimeNodes(interactor.controls(), interactor.workspaceNode(), interactor.state());
    }

    public Node controls() {
        return controls;
    }

    public Node workspace() {
        return workspace;
    }

    public Node state() {
        return state;
    }
}
