package shell.api;

import javafx.scene.Node;
import java.util.function.Supplier;
import java.util.Objects;
import org.jspecify.annotations.Nullable;

/**
 * Passive registration metadata for a navigable shell tab.
 * The optional navigation-graphic supplier stays feature-owned so each
 * contribution can provide its own icon at registration time.
 */
public record ShellTabSpec(
        ContributionKey key,
        NavigationGroupSpec navigationGroup,
        int viewOrder,
        boolean defaultLanding,
        @Nullable Supplier<? extends Node> navigationGraphicSupplier,
        ShellTabMode mode
) implements ShellContributionSpec {

    public ShellTabSpec {
        Objects.requireNonNull(key, "key");
        Objects.requireNonNull(navigationGroup, "navigationGroup");
        Objects.requireNonNull(mode, "mode");
    }

    public @Nullable Node navigationGraphic() {
        return navigationGraphicSupplier == null ? null : navigationGraphicSupplier.get();
    }
}
