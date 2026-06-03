package src.domain.dungeon.model.worldspace;

import java.util.Objects;
import src.domain.dungeon.model.core.geometry.Cell;

/**
 * Domain-local cell value object.
 */
public final class DungeonCell {
    private final Cell geometry;

    public DungeonCell(
            int q,
            int r,
            int level
    ) {
        this(new Cell(q, r, level));
    }

    private DungeonCell(Cell geometry) {
        this.geometry = Objects.requireNonNull(geometry);
    }

    static DungeonCell fromGeometry(Cell geometry) {
        return new DungeonCell(geometry);
    }

    Cell geometry() {
        return geometry;
    }

    public int q() {
        return geometry.q();
    }

    public int r() {
        return geometry.r();
    }

    public int level() {
        return geometry.level();
    }

    @Override
    public boolean equals(Object other) {
        return other instanceof DungeonCell that
                && geometry.equals(that.geometry);
    }

    @Override
    public int hashCode() {
        return geometry.hashCode();
    }

    @Override
    public String toString() {
        return "DungeonCell[q=" + q() + ", r=" + r() + ", level=" + level() + "]";
    }
}
