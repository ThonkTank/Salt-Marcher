package shell.api;

import javafx.scene.Node;
import java.util.function.Supplier;
import java.util.Objects;
import org.jspecify.annotations.Nullable;

/**
 * Passive registration metadata for a navigable left-bar tab.
 * The optional navigation-graphic supplier stays contribution-owned so each
 * entry can provide its own icon at registration time.
 */
public record ShellLeftBarTabSpec(
        ContributionKey key,
        NavigationGroupSpec navigationGroup,
        int viewOrder,
        boolean defaultLanding,
        @Nullable Supplier<? extends Node> navigationGraphicSupplier,
        ShellLeftBarTabMode mode
) implements ShellContributionSpec {

    public ShellLeftBarTabSpec {
        Objects.requireNonNull(key, "key");
        Objects.requireNonNull(navigationGroup, "navigationGroup");
        Objects.requireNonNull(mode, "mode");
    }

    public @Nullable Node navigationGraphic() {
        return navigationGraphicSupplier == null ? null : navigationGraphicSupplier.get();
    }
}
