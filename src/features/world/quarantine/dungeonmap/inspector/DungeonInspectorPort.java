package features.world.quarantine.dungeonmap.inspector;

import javafx.scene.Node;
import ui.shell.DetailsNavigator;

import java.util.function.Supplier;

/**
 * Narrow inspector API for the dungeon editor. Decouples the editor session
 * from the shell-level {@code DetailsNavigator}.
 */
public interface DungeonInspectorPort {

    void showContent(String title, Object entryKey, Supplier<Node> contentSupplier);

    void showInfo(String title, Object entryKey, String message);

    boolean isShowing(Object entryKey);

    static DungeonInspectorPort fromNavigator(DetailsNavigator nav) {
        return new DungeonInspectorPort() {
            @Override
            public void showContent(String title, Object entryKey, Supplier<Node> contentSupplier) {
                nav.showContent(title, entryKey, contentSupplier);
            }

            @Override
            public void showInfo(String title, Object entryKey, String message) {
                nav.showInfo(title, entryKey, message);
            }

            @Override
            public boolean isShowing(Object entryKey) {
                return nav.isShowing(entryKey);
            }
        };
    }
}
