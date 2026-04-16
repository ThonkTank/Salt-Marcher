package shell.host;

import java.util.Objects;

/**
 * Passive registration metadata for a navigable shell tab.
 */
public record ShellTabSpec(
        ContributionKey key,
        NavigationGroupSpec navigationGroup,
        int viewOrder,
        boolean defaultLanding,
        ShellTabMode mode
) implements ShellContributionSpec {

    public ShellTabSpec {
        Objects.requireNonNull(key, "key");
        Objects.requireNonNull(navigationGroup, "navigationGroup");
        Objects.requireNonNull(mode, "mode");
    }
}
