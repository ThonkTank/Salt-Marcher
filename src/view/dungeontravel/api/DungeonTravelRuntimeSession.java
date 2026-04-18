package src.view.dungeontravel.api;

import java.util.Objects;
import javafx.scene.Node;
import src.view.dungeonshared.api.DungeonSelectionPublisher;
import src.view.dungeontravel.interactor.DungeonTravelInteractor;

public final class DungeonTravelRuntimeSession {

    private final Node controls;
    private final Node workspace;
    private final Node state;

    private DungeonTravelRuntimeSession(Node controls, Node workspace, Node state) {
        this.controls = Objects.requireNonNull(controls, "controls");
        this.workspace = Objects.requireNonNull(workspace, "workspace");
        this.state = Objects.requireNonNull(state, "state");
    }

    public static DungeonTravelRuntimeSession create(DungeonSelectionPublisher selectionPublisher) {
        DungeonTravelInteractor interactor =
                new DungeonTravelInteractor(Objects.requireNonNull(selectionPublisher, "selectionPublisher"));
        return new DungeonTravelRuntimeSession(interactor.controls(), interactor.workspaceNode(), interactor.state());
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

    public static DungeonTravelRuntimeSession of(Node controls, Node workspace, Node state) {
        return new DungeonTravelRuntimeSession(controls, workspace, state);
    }
}
