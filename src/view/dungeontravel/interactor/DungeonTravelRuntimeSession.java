package src.view.dungeontravel.interactor;

import javafx.scene.Node;
import shell.host.InspectorSink;

import java.util.Objects;

public final class DungeonTravelRuntimeSession {

    private final DungeonTravelInteractor interactor;

    public DungeonTravelRuntimeSession(InspectorSink inspector) {
        this.interactor = new DungeonTravelInteractor(Objects.requireNonNull(inspector, "inspector"));
    }

    public Node controls() {
        return interactor.controls();
    }

    public Node workspace() {
        return interactor.workspace();
    }

    public Node state() {
        return interactor.state();
    }
}
