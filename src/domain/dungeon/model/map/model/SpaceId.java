package src.domain.dungeon.model.map.model;

import java.util.Objects;

public final class SpaceId {
    private final long value;

    public SpaceId(long value) {
        this.value = Math.max(1L, value);
    }

    public long value() {
        return value;
    }

    @Override
    public boolean equals(Object other) {
        return other instanceof SpaceId that && value == that.value;
    }

    @Override
    public int hashCode() {
        return Objects.hash(value);
    }

    @Override
    public String toString() {
        return "SpaceId[value=" + value + "]";
    }
}
