package platform.state;

import java.util.Objects;

public record StateSnapshot<T>(long revision, T value) {

    public StateSnapshot {
        if (revision < 0L) {
            throw new IllegalArgumentException("revision must not be negative");
        }
        value = Objects.requireNonNull(value, "value");
    }
}
