package src.view.dungeonmap.api;

import java.util.function.Supplier;
import javafx.scene.Node;
import javafx.scene.layout.Pane;

public record DungeonControlsExtensions(
        Supplier<Node> mapRowActions,
        Supplier<Node> modeControls,
        Supplier<Node> secondaryActions,
        Supplier<Node> footerContent
) {

    public DungeonControlsExtensions {
        mapRowActions = safeSupplier(mapRowActions);
        modeControls = safeSupplier(modeControls);
        secondaryActions = safeSupplier(secondaryActions);
        footerContent = safeSupplier(footerContent);
    }

    public static DungeonControlsExtensions empty() {
        return new DungeonControlsExtensions(Pane::new, Pane::new, Pane::new, Pane::new);
    }

    private static Supplier<Node> safeSupplier(Supplier<Node> supplier) {
        return supplier == null ? Pane::new : supplier;
    }
}
