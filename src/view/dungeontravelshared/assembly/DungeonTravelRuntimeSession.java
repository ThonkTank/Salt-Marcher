package src.view.dungeontravelshared.assembly;

import javafx.scene.Node;
import shell.host.InspectorSink;
import shell.host.ShellRuntimeContext;
import src.view.dungeonshared.assembly.DungeonSelectionInspectorShellAdapter;
import src.view.dungeontravel.interactor.DungeonTravelInteractor;

import java.util.Objects;

public final class DungeonTravelRuntimeSession {

    private final DungeonTravelInteractor interactor;

    public static DungeonTravelRuntimeSession from(ShellRuntimeContext runtimeContext) {
        Objects.requireNonNull(runtimeContext, "runtimeContext");
        return runtimeContext.session(
                DungeonTravelRuntimeSession.class,
                () -> new DungeonTravelRuntimeSession(runtimeContext.inspector()));
    }

    public DungeonTravelRuntimeSession(InspectorSink inspector) {
        this.interactor = new DungeonTravelInteractor(
                new DungeonSelectionInspectorShellAdapter(Objects.requireNonNull(inspector, "inspector")));
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
