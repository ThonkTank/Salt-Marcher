package src.domain.dungeon.model.map.model;

import java.util.Objects;

public final class FeatureId {
    private final long value;

    public FeatureId(long value) {
        this.value = Math.max(1L, value);
    }

    public long value() {
        return value;
    }

    @Override
    public boolean equals(Object other) {
        return other instanceof FeatureId that && value == that.value;
    }

    @Override
    public int hashCode() {
        return Objects.hash(value);
    }

    @Override
    public String toString() {
        return "FeatureId[value=" + value + "]";
    }
}
