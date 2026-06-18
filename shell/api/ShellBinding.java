package shell.api;

import java.util.Map;
import javafx.scene.Node;

/**
 * Bound shell content for one contribution model.
 */
public interface ShellBinding {

    String title();

    Map<ShellSlot, Node> slotContent();

    default void onActivate() {
        // Default hook is intentionally empty; models opt in when activation work is needed.
    }

    default void onDeactivate() {
        // Default hook is intentionally empty; models opt in when deactivation work is needed.
    }
}
