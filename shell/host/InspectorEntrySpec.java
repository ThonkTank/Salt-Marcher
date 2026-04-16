package shell.host;

import javafx.scene.Node;

import java.util.function.Supplier;

/**
 * Passive shell descriptor for one inspector history entry.
 */
public record InspectorEntrySpec(
        String title,
        Object entryKey,
        Supplier<Node> contentSupplier,
        Supplier<Node> footerSupplier
) {
}
