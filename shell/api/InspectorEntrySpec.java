package shell.api;

import javafx.scene.Node;
import org.jspecify.annotations.Nullable;

import java.util.function.Supplier;

/**
 * Passive shell descriptor for one inspector history entry.
 */
public record InspectorEntrySpec(
        String title,
        Object entryKey,
        Supplier<Node> contentSupplier,
        @Nullable Supplier<Node> footerSupplier
) {
}
