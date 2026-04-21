package shell.api;

import java.util.Objects;
import org.jspecify.annotations.Nullable;

/**
 * Passive registration metadata for a navigable left-bar tab.
 * Contributions may reference a resource-backed navigation graphic, but the
 * shell owns loading and rendering it.
 */
public record ShellLeftBarTabSpec(
        ContributionKey key,
        NavigationGroupSpec navigationGroup,
        int viewOrder,
        boolean defaultLanding,
        @Nullable NavigationGraphicResource navigationGraphic,
        ShellLeftBarTabMode mode
) implements ShellContributionSpec {

    public ShellLeftBarTabSpec {
        Objects.requireNonNull(key, "key");
        Objects.requireNonNull(navigationGroup, "navigationGroup");
        Objects.requireNonNull(mode, "mode");
    }
}
