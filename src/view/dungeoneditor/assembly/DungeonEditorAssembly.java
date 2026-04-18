package src.view.dungeoneditor.assembly;

import java.util.Map;
import java.util.Objects;
import java.util.function.Supplier;
import javafx.scene.Node;
import javafx.scene.shape.Line;
import javafx.scene.shape.Rectangle;
import static shell.api.NavigationGraphicSupport.filledRect;
import static shell.api.NavigationGraphicSupport.strokeLine;
import static shell.api.NavigationGraphicSupport.wrap;
import shell.api.ShellRuntimeContext;
import shell.api.ShellScreen;
import shell.api.ShellSlot;
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
        return DungeonEditorAssembly::navigationGraphic;
    }

    private static Node navigationGraphic() {
        Rectangle cellA = filledRect(3, 3, 5, 5);
        Rectangle cellB = filledRect(10, 3, 5, 5);
        Rectangle cellC = filledRect(3, 10, 5, 5);
        Rectangle cellD = new Rectangle(10, 10, 5, 5);
        cellD.getStyleClass().add("nav-icon-stroke");
        cellD.setFill(null);

        Line tool = strokeLine(11, 14, 15, 10);
        return wrap(cellA, cellB, cellC, cellD, tool);
    }

}
