package shell.host;

import javafx.scene.Node;
import shell.panel.ShellSlot;

import java.util.EnumMap;
import java.util.Map;

/**
 * Sanitized slot content published by a shell screen.
 */
public final class ShellSlotContent {

    private final Map<ShellSlot, Node> nodes;

    ShellSlotContent(Map<ShellSlot, Node> nodes) {
        this.nodes = Map.copyOf(nodes);
    }

    static ShellSlotContent from(ShellScreen screen) {
        Map<ShellSlot, Node> provided = screen.slotContent();
        if (provided == null || provided.isEmpty()) {
            return new ShellSlotContent(Map.of());
        }
        EnumMap<ShellSlot, Node> sanitized = new EnumMap<>(ShellSlot.class);
        for (Map.Entry<ShellSlot, Node> entry : provided.entrySet()) {
            if (entry.getKey() == null) {
                throw new IllegalArgumentException("Shell screen must not declare a null slot key.");
            }
            if (entry.getValue() != null) {
                sanitized.put(entry.getKey(), entry.getValue());
            }
        }
        return new ShellSlotContent(sanitized);
    }

    boolean contains(ShellSlot slot) {
        return nodes.containsKey(slot);
    }

    public Node topBar() {
        return nodes.get(ShellSlot.TOP_BAR);
    }

    public Node controls() {
        return nodes.get(ShellSlot.COCKPIT_CONTROLS);
    }

    public Node main() {
        return nodes.get(ShellSlot.COCKPIT_MAIN);
    }

    public Node editorState() {
        return nodes.get(ShellSlot.COCKPIT_STATE);
    }

    public Node runtimeState() {
        return nodes.get(ShellSlot.COCKPIT_STATE);
    }
}
