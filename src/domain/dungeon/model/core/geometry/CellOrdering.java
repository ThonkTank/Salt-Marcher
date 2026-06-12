package src.domain.dungeon.model.core.geometry;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

public final class CellOrdering {

    private CellOrdering() {
    }

    public static List<Cell> sortedCells(Iterable<Cell> cells) {
        List<Cell> result = new ArrayList<>();
        Set<Cell> seen = new HashSet<>();
        for (Cell cell : Objects.requireNonNull(cells)) {
            if (seen.add(Objects.requireNonNull(cell))) {
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
