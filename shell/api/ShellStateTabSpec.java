package shell.api;

import java.util.Objects;

/**
 * Passive registration metadata for a global state tab.
 */
public record ShellStateTabSpec(
        ContributionKey key,
        String tabLabel,
        int itemOrder
) implements ShellContributionSpec {

    public ShellStateTabSpec {
        Objects.requireNonNull(key, "key");
        Objects.requireNonNull(tabLabel, "tabLabel");
        if (tabLabel.isBlank()) {
            throw new IllegalArgumentException("State tab label must not be blank.");
        }
    }
}
