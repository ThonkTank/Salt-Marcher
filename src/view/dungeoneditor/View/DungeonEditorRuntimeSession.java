package src.view.dungeoneditor.View;

import java.util.Objects;
import java.util.function.Supplier;
import javafx.scene.Node;
import src.view.dungeonmap.View.DungeonEditorRuntimeNodes;
import src.view.dungeonmap.api.DungeonSelectionPublisher;

public final class DungeonEditorRuntimeSession {

    private final Supplier<Node> controls;
    private final Supplier<Node> workspace;
    private final Supplier<Node> state;

    private DungeonEditorRuntimeSession(Supplier<Node> controls, Supplier<Node> workspace, Supplier<Node> state) {
        this.controls = Objects.requireNonNull(controls, "controls");
        this.workspace = Objects.requireNonNull(workspace, "workspace");
        this.state = Objects.requireNonNull(state, "state");
    }

    public static DungeonEditorRuntimeSession create(DungeonSelectionPublisher selectionPublisher) {
        DungeonEditorRuntimeNodes nodes =
                DungeonEditorRuntimeNodes.create(Objects.requireNonNull(selectionPublisher, "selectionPublisher"));
        return new DungeonEditorRuntimeSession(nodes::controls, nodes::workspace, nodes::state);
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

    public static DungeonEditorRuntimeSession of(Node controls, Node workspace, Node state) {
        Objects.requireNonNull(controls, "controls");
        Objects.requireNonNull(workspace, "workspace");
        Objects.requireNonNull(state, "state");
        return new DungeonEditorRuntimeSession(() -> controls, () -> workspace, () -> state);
    }
}
