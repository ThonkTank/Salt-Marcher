package shell.host;

import java.util.Objects;

/**
 * Open sidebar group metadata supplied by the feature itself.
 */
public record NavigationGroupSpec(String key, String label, int order) {

    public NavigationGroupSpec {
        Objects.requireNonNull(key, "key");
        Objects.requireNonNull(label, "label");
        if (key.isBlank()) {
            throw new IllegalArgumentException("Navigation group key must not be blank.");
        }
        if (label.isBlank()) {
            throw new IllegalArgumentException("Navigation group label must not be blank.");
        }
    }
}
