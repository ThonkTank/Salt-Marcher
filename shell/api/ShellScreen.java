package shell.api;

import java.util.Map;
import javafx.scene.Node;

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
     * Prepared UI components keyed by fixed shell slots. Required slots depend on the contribution spec type.
     */
    Map<ShellSlot, Node> slotContent();

    /**
     * Called each time this screen becomes active.
     */
    default void onShow() {
        // Default hook is intentionally empty; screens opt in when activation work is needed.
    }

    /**
     * Called when navigating away from this screen.
     */
    default void onHide() {
        // Default hook is intentionally empty; screens opt in when deactivation work is needed.
    }
}
