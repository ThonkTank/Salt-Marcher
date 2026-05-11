package src.domain.dungeon.model.map.model;

import java.util.Objects;

/**
 * Domain-local cell value object.
 */
public final class DungeonCell {
    private final int q;
    private final int r;
    private final int level;

    public DungeonCell(
            int q,
            int r,
            int level
    ) {
        this.q = q;
        this.r = r;
        this.level = level;
    }

    public int q() {
        return q;
    }

    public int r() {
        return r;
    }

    public int level() {
        return level;
    }

    @Override
    public boolean equals(Object other) {
        return other instanceof DungeonCell that
                && q == that.q
                && r == that.r
                && level == that.level;
    }

    @Override
    public int hashCode() {
        return Objects.hash(q, r, level);
    }

    @Override
    public String toString() {
        return "DungeonCell[q=" + q + ", r=" + r + ", level=" + level + "]";
    }
}
