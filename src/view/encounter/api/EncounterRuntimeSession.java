package src.view.encounter.api;

import javafx.scene.Node;
import src.view.encounter.assembly.EncounterRuntimeSessionFactory;

import java.util.Objects;

public final class EncounterRuntimeSession {

    private final Node controls;
    private final Node workspace;
    private final Node state;

    private EncounterRuntimeSession(Node controls, Node workspace, Node state) {
        this.controls = Objects.requireNonNull(controls, "controls");
        this.workspace = Objects.requireNonNull(workspace, "workspace");
        this.state = Objects.requireNonNull(state, "state");
    }

    public static EncounterRuntimeSession create(Object encounterService, Object creatureService) {
        return EncounterRuntimeSessionFactory.create(encounterService, creatureService);
    }

    public static EncounterRuntimeSession of(Node controls, Node workspace, Node state) {
        return new EncounterRuntimeSession(controls, workspace, state);
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
