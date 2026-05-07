package src.domain.dungeon.map.value;

import java.util.Objects;

public final class CorridorSegmentId {
    private final long value;

    public CorridorSegmentId(long value) {
        this.value = Math.max(1L, value);
    }

    public long value() {
        return value;
    }

    @Override
    public boolean equals(Object other) {
        return other instanceof CorridorSegmentId that && value == that.value;
    }

    @Override
    public int hashCode() {
        return Objects.hash(value);
    }

    @Override
    public String toString() {
        return "CorridorSegmentId[value=" + value + "]";
    }
}
