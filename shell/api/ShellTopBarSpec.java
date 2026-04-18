package shell.api;

import java.util.Objects;

/**
 * Passive registration metadata for a global top-bar contribution.
 */
public record ShellTopBarSpec(
        ContributionKey key,
        int itemOrder
) implements ShellContributionSpec {

    public ShellTopBarSpec {
        Objects.requireNonNull(key, "key");
    }
}
