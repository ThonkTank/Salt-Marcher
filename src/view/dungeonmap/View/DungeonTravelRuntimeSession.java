package src.view.dungeonmap.View;

import java.util.Objects;
import java.util.function.Supplier;
import javafx.scene.Node;
import src.view.dungeonmap.ViewModel.internal.DungeonTravelInteractor;
import src.view.dungeonmap.api.DungeonSelectionPublisher;

public final class DungeonTravelRuntimeSession {

    private final Supplier<Node> controls;
    private final Supplier<Node> workspace;
    private final Supplier<Node> state;

    private DungeonTravelRuntimeSession(Supplier<Node> controls, Supplier<Node> workspace, Supplier<Node> state) {
        this.controls = Objects.requireNonNull(controls, "controls");
        this.workspace = Objects.requireNonNull(workspace, "workspace");
        this.state = Objects.requireNonNull(state, "state");
    }

    public static DungeonTravelRuntimeSession create(DungeonSelectionPublisher selectionPublisher) {
        DungeonTravelInteractor interactor =
                new DungeonTravelInteractor(Objects.requireNonNull(selectionPublisher, "selectionPublisher"));
        return of(interactor.controls(), interactor.workspaceNode(), interactor.state());
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

    public static DungeonTravelRuntimeSession of(Node controls, Node workspace, Node state) {
        Objects.requireNonNull(controls, "controls");
        Objects.requireNonNull(workspace, "workspace");
        Objects.requireNonNull(state, "state");
        return new DungeonTravelRuntimeSession(() -> controls, () -> workspace, () -> state);
    }
}
