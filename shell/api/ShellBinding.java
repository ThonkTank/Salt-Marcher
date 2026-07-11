package shell.api;

import java.util.Map;
import javafx.scene.Node;

/**
 * Bound shell content for one contribution model.
 */
public interface ShellBinding {

    String title();

    Map<ShellSlot, Node> slotContent();

    static ShellBinding cockpit(String title, Node controls, Node main) {
        return new BasicShellBinding(title, Map.of(ShellSlot.COCKPIT_CONTROLS, controls, ShellSlot.COCKPIT_MAIN, main));
    }

    static ShellBinding topBar(String title, Node topBar) {
        return new BasicShellBinding(title, Map.of(ShellSlot.TOP_BAR, topBar));
    }

    static ShellBinding state(String title, Node state) {
        return new BasicShellBinding(title, Map.of(ShellSlot.COCKPIT_STATE, state));
    }

    default void onActivate() {
        // Default hook is intentionally empty; models opt in when activation work is needed.
    }

    default void onDeactivate() {
        // Default hook is intentionally empty; models opt in when deactivation work is needed.
    }

    record BasicShellBinding(String title, Map<ShellSlot, Node> slotContent) implements ShellBinding {
        public BasicShellBinding {
            slotContent = Map.copyOf(slotContent);
        }
    }
}
