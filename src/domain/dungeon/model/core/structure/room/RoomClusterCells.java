package src.domain.dungeon.model.core.structure.room;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.CellOrdering;
import src.domain.dungeon.model.core.geometry.Direction;

final class RoomClusterCells {

    private RoomClusterCells() {
    }

    static Set<Cell> rectangle(Cell start, Cell end) {
        if (start == null || end == null) {
            return Set.of();
        }
        int level = start.level();
        int minQ = Math.min(start.q(), end.q());
        int maxQ = Math.max(start.q(), end.q());
        int minR = Math.min(start.r(), end.r());
        int maxR = Math.max(start.r(), end.r());
        Set<Cell> cells = new LinkedHashSet<>();
        for (int q = minQ; q <= maxQ; q++) {
            for (int r = minR; r <= maxR; r++) {
                cells.add(new Cell(q, r, level));
            }
        }
        return Set.copyOf(cells);
    }

    static List<Cell> sortedCells(Iterable<Cell> cells) {
        List<Cell> filtered = new ArrayList<>();
        for (Cell cell : cells == null ? List.<Cell>of() : cells) {
            if (cell != null) {
                filtered.add(cell);
            }
        }
        return CellOrdering.sortedCells(filtered);
    }

    static List<Set<Cell>> connectedComponents(Set<Cell> cells) {
        Set<Cell> remaining = new LinkedHashSet<>(cells == null ? Set.<Cell>of() : cells);
        List<Set<Cell>> components = new ArrayList<>();
        while (!remaining.isEmpty()) {
            components.add(floodComponent(remaining.iterator().next(), remaining));
        }
        components.sort(RoomClusterCells::compareComponents);
        return List.copyOf(components);
    }

    private static Set<Cell> floodComponent(Cell start, Set<Cell> remaining) {
        Set<Cell> component = new LinkedHashSet<>();
        Deque<Cell> queue = new ArrayDeque<>();
        queue.add(start);
        remaining.remove(start);
        while (!queue.isEmpty()) {
            Cell current = queue.removeFirst();
            component.add(current);
            for (Direction direction : Direction.values()) {
                Cell neighbor = direction.neighborOf(current);
                if (remaining.remove(neighbor)) {
                    queue.addLast(neighbor);
                }
            }
        }
        return Set.copyOf(component);
    }

    private static int compareComponents(Set<Cell> left, Set<Cell> right) {
        Cell leftMinimum = minimum(left);
        Cell rightMinimum = minimum(right);
        if (leftMinimum == null && rightMinimum == null) {
            return 0;
        }
        if (leftMinimum == null) {
            return -1;
        }
        if (rightMinimum == null) {
            return 1;
        }
        return CellOrdering.compareCells(leftMinimum, rightMinimum);
    }

    private static Cell minimum(Set<Cell> component) {
        List<Cell> sorted = sortedCells(component);
        return sorted.isEmpty() ? null : sorted.getFirst();
    }
}
