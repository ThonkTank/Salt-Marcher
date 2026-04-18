package src.view.dungeontravel.assembly;

import java.util.Map;
import java.util.Objects;
import java.util.function.Supplier;
import javafx.scene.Node;
import javafx.scene.shape.Line;
import javafx.scene.shape.Rectangle;
import static shell.api.NavigationGraphicSupport.strokeLine;
import static shell.api.NavigationGraphicSupport.wrap;
import shell.api.ShellRuntimeContext;
import shell.api.ShellScreen;
import shell.api.ShellSlot;
import src.view.dungeontravel.api.DungeonTravelRuntimeSession;

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
        return DungeonTravelAssembly::navigationGraphic;
    }

    private static Node navigationGraphic() {
        Rectangle outer = new Rectangle(3, 3, 12, 12);
        outer.getStyleClass().add("nav-icon-stroke");
        outer.setArcWidth(2);
        outer.setArcHeight(2);
        outer.setFill(null);

        Line wallV = strokeLine(9, 3, 9, 11);
        Line wallH = strokeLine(3, 9, 12, 9);
        Line door = strokeLine(12, 9, 15, 9);
        return wrap(outer, wallV, wallH, door);
    }

}
