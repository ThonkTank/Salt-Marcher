package src.view.encounter.api;

import javafx.scene.Node;
import src.view.encounter.assembly.EncounterRuntimeSessionFactory;

import java.util.Objects;
import java.util.function.Supplier;

public final class EncounterRuntimeSession {

    private final Supplier<Node> controls;
    private final Supplier<Node> workspace;
    private final Supplier<Node> state;

    private EncounterRuntimeSession(Supplier<Node> controls, Supplier<Node> workspace, Supplier<Node> state) {
        this.controls = Objects.requireNonNull(controls, "controls");
        this.workspace = Objects.requireNonNull(workspace, "workspace");
        this.state = Objects.requireNonNull(state, "state");
    }

    public static EncounterRuntimeSession create(Object encounterService, Object creatureService) {
        return EncounterRuntimeSessionFactory.create(encounterService, creatureService);
    }

    public static EncounterRuntimeSession of(Node controls, Node workspace, Node state) {
        Objects.requireNonNull(controls, "controls");
        Objects.requireNonNull(workspace, "workspace");
        Objects.requireNonNull(state, "state");
        return new EncounterRuntimeSession(() -> controls, () -> workspace, () -> state);
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
