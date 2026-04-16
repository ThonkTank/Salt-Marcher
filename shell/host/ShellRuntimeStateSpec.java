package shell.host;

import java.util.Objects;

/**
 * Passive registration metadata for a global runtime-state tab.
 */
public record ShellRuntimeStateSpec(
        ContributionKey key,
        String tabLabel,
        int itemOrder
) implements ShellContributionSpec {

    public ShellRuntimeStateSpec {
        Objects.requireNonNull(key, "key");
        Objects.requireNonNull(tabLabel, "tabLabel");
        if (tabLabel.isBlank()) {
            throw new IllegalArgumentException("Runtime state tab label must not be blank.");
        }
    }
}
