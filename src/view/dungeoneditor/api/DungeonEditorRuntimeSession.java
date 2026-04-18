package src.view.dungeoneditor.api;

import java.util.Objects;
import javafx.scene.Node;
import src.view.dungeoneditor.interactor.DungeonEditorInteractor;
import src.view.dungeonshared.api.DungeonSelectionPublisher;

public final class DungeonEditorRuntimeSession {

    private final Node controls;
    private final Node workspace;
    private final Node state;

    private DungeonEditorRuntimeSession(Node controls, Node workspace, Node state) {
        this.controls = Objects.requireNonNull(controls, "controls");
        this.workspace = Objects.requireNonNull(workspace, "workspace");
        this.state = Objects.requireNonNull(state, "state");
    }

    public static DungeonEditorRuntimeSession create(DungeonSelectionPublisher selectionPublisher) {
        DungeonEditorInteractor interactor =
                new DungeonEditorInteractor(Objects.requireNonNull(selectionPublisher, "selectionPublisher"));
        return new DungeonEditorRuntimeSession(interactor.controls(), interactor.workspaceNode(), interactor.state());
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

    public static DungeonEditorRuntimeSession of(Node controls, Node workspace, Node state) {
        return new DungeonEditorRuntimeSession(controls, workspace, state);
    }
}
