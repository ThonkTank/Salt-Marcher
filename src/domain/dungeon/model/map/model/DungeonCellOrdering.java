package src.domain.dungeon.model.map.model;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

final class DungeonCellOrdering {

    private DungeonCellOrdering() {
    }

    static List<DungeonCell> sortedCells(Iterable<DungeonCell> cells) {
        List<DungeonCell> result = new ArrayList<>();
        for (DungeonCell cell : cells == null ? List.<DungeonCell>of() : cells) {
            if (cell != null) {
                result.add(cell);
            }
        }
        List<DungeonCell> unique = new ArrayList<>();
        for (DungeonCell cell : result) {
            if (!unique.contains(cell)) {
                unique.add(cell);
            }
        }
        unique.sort(DungeonCellOrdering::compareCells);
        return List.copyOf(unique);
    }

    static List<Set<DungeonCell>> sortedComponents(Iterable<Set<DungeonCell>> components) {
        List<Set<DungeonCell>> result = new ArrayList<>();
        for (Set<DungeonCell> component : components == null ? List.<Set<DungeonCell>>of() : components) {
            if (component != null) {
                result.add(component);
            }
        }
        result.sort(DungeonCellOrdering::compareComponents);
        return List.copyOf(result);
    }

    static int compareCells(DungeonCell left, DungeonCell right) {
        if (left == null && right == null) {
            return 0;
        }
        if (left == null) {
            return -1;
        }
        if (right == null) {
            return 1;
        }
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

    private static int minimumLevel(Set<DungeonCell> component) {
        int result = 0;
        boolean found = false;
        for (DungeonCell cell : component == null ? Set.<DungeonCell>of() : component) {
            if (cell != null && (!found || cell.level() < result)) {
                result = cell.level();
                found = true;
            }
        }
        return result;
    }

    private static int minimumRow(Set<DungeonCell> component) {
        int result = 0;
        boolean found = false;
        for (DungeonCell cell : component == null ? Set.<DungeonCell>of() : component) {
            if (cell != null && (!found || cell.r() < result)) {
                result = cell.r();
                found = true;
            }
        }
        return result;
    }

    private static int minimumColumn(Set<DungeonCell> component) {
        int result = 0;
        boolean found = false;
        for (DungeonCell cell : component == null ? Set.<DungeonCell>of() : component) {
            if (cell != null && (!found || cell.q() < result)) {
                result = cell.q();
                found = true;
            }
        }
        return result;
    }

    private static int compareComponents(Set<DungeonCell> left, Set<DungeonCell> right) {
        int levelComparison = Integer.compare(minimumLevel(left), minimumLevel(right));
        if (levelComparison != 0) {
            return levelComparison;
        }
        int rowComparison = Integer.compare(minimumRow(left), minimumRow(right));
        if (rowComparison != 0) {
            return rowComparison;
        }
        return Integer.compare(minimumColumn(left), minimumColumn(right));
    }
}
