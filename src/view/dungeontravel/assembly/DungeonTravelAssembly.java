package src.view.dungeontravel.assembly;

import java.util.Map;
import java.util.Objects;
import java.util.function.Supplier;
import javafx.scene.Node;
import shell.api.ShellRuntimeContext;
import shell.api.ShellScreen;
import shell.api.ShellSlot;
import src.view.dungeontravel.View.DungeonTravelNavigationGraphic;
import src.view.dungeonshared.api.DungeonTravelRuntimeSession;

public final class DungeonTravelAssembly {

    private DungeonTravelAssembly() {
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
                return "Dungeon Travel";
            }

            @Override
            public String getNavigationLabel() {
                return "Travel";
            }

            @Override
            public Map<ShellSlot, Node> slotContent() {
                return Map.of(
                        ShellSlot.COCKPIT_CONTROLS, session.controls(),
                        ShellSlot.COCKPIT_MAIN, session.workspace()
                );
            }
        };
    }

    public static Supplier navigationGraphicSupplier() {
        return DungeonTravelNavigationGraphic::create;
    }

}
