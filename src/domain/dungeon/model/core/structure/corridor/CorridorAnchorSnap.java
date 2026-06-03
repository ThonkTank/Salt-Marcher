package src.domain.dungeon.model.core.structure.corridor;

import src.domain.dungeon.model.core.geometry.Cell;

public final class CorridorAnchorSnap {
    private static final Cell ORIGIN = new Cell(0, 0, 0);

    private CorridorAnchorSnap() {
    }

    public static Cell nearestHostCell(Cell desired, Iterable<Cell> hostCells) {
        Cell target = desired == null ? ORIGIN : desired;
        if (hostCells == null) {
            return target;
        }
        Cell result = null;
        for (Cell candidate : hostCells) {
            if (candidate != null && betterSnapCandidate(candidate, result, target)) {
                result = candidate;
            }
        }
        return result == null ? target : result;
    }

    private static boolean betterSnapCandidate(Cell candidate, Cell current, Cell desired) {
        if (current == null) {
            return true;
        }
        int distanceComparison = Integer.compare(manhattan(desired, candidate), manhattan(desired, current));
        if (distanceComparison != 0) {
            return distanceComparison < 0;
        }
        int levelComparison = Integer.compare(candidate.level(), current.level());
        if (levelComparison != 0) {
            return levelComparison < 0;
        }
        int rowComparison = Integer.compare(candidate.r(), current.r());
        if (rowComparison != 0) {
            return rowComparison < 0;
        }
        return candidate.q() < current.q();
    }

    private static int manhattan(Cell left, Cell right) {
        return Math.abs(left.q() - right.q())
                + Math.abs(left.r() - right.r())
                + Math.abs(left.level() - right.level());
    }
}
