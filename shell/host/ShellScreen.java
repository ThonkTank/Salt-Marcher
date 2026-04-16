package shell.host;

import javafx.scene.Node;
import shell.panel.ShellSlot;

import java.util.Map;

/**
 * Feature-owned screen description that projects prepared UI components into fixed shell slots.
 */
public interface ShellScreen {

    /**
     * Title shown in the top toolbar when this feature is active.
     */
    String getTitle();

    /**
     * Short label used for the feature's navigation entry in the left sidebar.
     */
    default String getNavigationLabel() {
        return "";
    }

    /**
     * Optional graphic used for the feature's navigation entry in the left sidebar.
     */
    default Node getNavigationGraphic() {
        return null;
    }

    /**
     * Prepared UI components keyed by fixed shell slots. Required slots depend on the contribution spec type.
     */
    Map<ShellSlot, Node> slotContent();

    /**
     * Called each time this screen becomes active.
     */
    default void onShow() {
    }

    /**
     * Called when navigating away from this screen.
     */
    default void onHide() {
    }
}
