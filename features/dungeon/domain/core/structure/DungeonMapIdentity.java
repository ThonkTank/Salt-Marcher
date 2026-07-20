package features.dungeon.domain.core.structure;

import java.util.Objects;

/**
 * Domain-local authored dungeon map identity.
 */
public final class DungeonMapIdentity {
    private final long value;

    public DungeonMapIdentity(long value) {
        this.value = Math.max(1L, value);
    }

    public long value() {
        return value;
    }

    @Override
    public boolean equals(Object other) {
        return other instanceof DungeonMapIdentity that && value == that.value;
    }

    @Override
    public int hashCode() {
        return Objects.hash(value);
    }

    @Override
    public String toString() {
        return "DungeonMapIdentity[value=" + value + "]";
    }
}
