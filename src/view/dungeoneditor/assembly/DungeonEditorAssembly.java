package src.view.dungeoneditor.assembly;

import java.util.Map;
import java.util.Objects;
import java.util.function.Supplier;
import javafx.scene.Node;
import shell.api.ShellRuntimeContext;
import shell.api.ShellScreen;
import shell.api.ShellSlot;
import src.view.dungeoneditor.View.DungeonEditorNavigationGraphic;
import src.view.dungeoneditor.api.DungeonEditorRuntimeSession;

public final class DungeonEditorAssembly {

    private DungeonEditorAssembly() {
    }

    public static ShellScreen createScreen(ShellRuntimeContext runtimeContext) {
        Objects.requireNonNull(runtimeContext, "runtimeContext");
        DungeonEditorRuntimeSession session = DungeonEditorRuntimeSession.create(
                new DungeonSelectionInspectorShellAdapter(runtimeContext.inspector()));
        return new ShellScreen() {
            @Override
            public String getTitle() {
                return "Dungeon Editor";
            }

            @Override
            public String getNavigationLabel() {
                return "Dungeon";
            }

            @Override
            public Map<ShellSlot, Node> slotContent() {
                return Map.of(
                        ShellSlot.COCKPIT_CONTROLS, session.controls(),
                        ShellSlot.COCKPIT_MAIN, session.workspace(),
                        ShellSlot.COCKPIT_STATE, session.state()
                );
            }
        };
    }

    public static Supplier navigationGraphicSupplier() {
        return DungeonEditorNavigationGraphic::create;
    }

}
