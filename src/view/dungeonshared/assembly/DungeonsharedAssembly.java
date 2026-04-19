package src.view.dungeonshared.assembly;
import java.util.Map;
import java.util.Objects;
import javafx.scene.Node;
import shell.api.ShellRuntimeContext;
import shell.api.ShellScreen;
import shell.api.ShellSlot;
import src.view.dungeonshared.api.DungeonTravelRuntimeSession;
public final class DungeonsharedAssembly {
    private DungeonsharedAssembly() {
    }
    public static ShellScreen createScreen(ShellRuntimeContext runtimeContext) {
        Objects.requireNonNull(runtimeContext, "runtimeContext");
        DungeonTravelRuntimeSession session = runtimeContext.session(
                DungeonTravelRuntimeSession.class,
                () -> DungeonTravelRuntimeSession.create(
                        new DungeonSelectionInspectorShellAdapter(runtimeContext.inspector())));
        return new ShellScreen() {
            @Override
            public String getTitle() {
                return "Dungeon Travel State";
            }
            @Override
            public Map<ShellSlot, Node> slotContent() {
                return Map.of(ShellSlot.COCKPIT_STATE, session.state());
            }
        };
    }
}
