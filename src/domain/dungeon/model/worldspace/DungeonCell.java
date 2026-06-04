package src.domain.dungeon.model.worldspace;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.CellOrdering;

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

    static List<DungeonCell> sortedByGeometry(Iterable<DungeonCell> cells) {
        List<Cell> geometryCells = new ArrayList<>();
        for (DungeonCell cell : cells == null ? List.<DungeonCell>of() : cells) {
            if (cell != null) {
                geometryCells.add(cell.geometry());
            }
        }
        List<DungeonCell> result = new ArrayList<>();
        for (Cell cell : CellOrdering.sortedCells(geometryCells)) {
            result.add(fromGeometry(cell));
        }
        return List.copyOf(result);
    }

    static int compareByGeometry(DungeonCell left, DungeonCell right) {
        if (left == null && right == null) {
            return 0;
        }
        if (left == null) {
            return -1;
        }
        if (right == null) {
            return 1;
        }
        return CellOrdering.compareCells(left.geometry(), right.geometry());
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
