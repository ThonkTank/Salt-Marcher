package shell.host;

import javafx.scene.Node;
import org.jspecify.annotations.Nullable;
import java.util.EnumMap;
import java.util.Map;
import shell.api.ShellBinding;
import shell.api.ShellSlot;

/**
 * Sanitized slot content published by a shell binding.
 */
final class ShellSlotContent {

    private final Map<ShellSlot, Node> nodes;

    ShellSlotContent(Map<ShellSlot, Node> nodes) {
        this.nodes = Map.copyOf(nodes);
    }

    static ShellSlotContent from(ShellBinding binding) {
        Map<ShellSlot, Node> provided = binding.slotContent();
        if (provided == null || provided.isEmpty()) {
            return new ShellSlotContent(Map.of());
        }
        Map<ShellSlot, Node> sanitized = new EnumMap<>(ShellSlot.class);
        for (Map.Entry<ShellSlot, Node> entry : provided.entrySet()) {
            if (entry.getKey() == null) {
                throw new IllegalArgumentException("Shell binding must not declare a null slot key.");
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

    @Nullable Node topBar() {
        return nodes.get(ShellSlot.TOP_BAR);
    }

    @Nullable Node controls() {
        return nodes.get(ShellSlot.COCKPIT_CONTROLS);
    }

    @Nullable Node main() {
        return nodes.get(ShellSlot.COCKPIT_MAIN);
    }

    @Nullable Node editorState() {
        return nodes.get(ShellSlot.COCKPIT_STATE);
    }

    @Nullable Node runtimeState() {
        return nodes.get(ShellSlot.COCKPIT_STATE);
    }
}
