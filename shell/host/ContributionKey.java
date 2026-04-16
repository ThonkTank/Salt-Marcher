package shell.host;

import java.util.Objects;

/**
 * Stable, open identifier for one shell contribution.
 */
public record ContributionKey(String value) {

    public ContributionKey {
        Objects.requireNonNull(value, "value");
        if (value.isBlank()) {
            throw new IllegalArgumentException("Contribution key must not be blank.");
        }
    }
}
