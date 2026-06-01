package src.domain.dungeon.model.core.model.geometry;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

public final class CellOrdering {

    private CellOrdering() {
    }

    public static List<Cell> sortedCells(Iterable<Cell> cells) {
        List<Cell> result = new ArrayList<>();
        for (Cell cell : Objects.requireNonNull(cells)) {
            if (!result.contains(Objects.requireNonNull(cell))) {
                result.add(cell);
            }
        }
        result.sort(CellOrdering::compareCells);
        return List.copyOf(result);
    }

    public static int compareCells(Cell left, Cell right) {
        Objects.requireNonNull(left);
        Objects.requireNonNull(right);
        int levelComparison = Integer.compare(left.level(), right.level());
        if (levelComparison != 0) {
            return levelComparison;
        }
        int rowComparison = Integer.compare(left.r(), right.r());
        if (rowComparison != 0) {
            return rowComparison;
        }
        return Integer.compare(left.q(), right.q());
    }
}
