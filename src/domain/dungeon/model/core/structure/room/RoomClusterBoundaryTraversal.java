package src.domain.dungeon.model.core.structure.room;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Direction;
import src.domain.dungeon.model.core.geometry.Edge;
import src.domain.dungeon.model.core.geometry.EdgeKey;

final class RoomClusterBoundaryTraversal {

    private RoomClusterBoundaryTraversal() {
    }

    static Set<EdgeKey> barriersAt(
            Map<Integer, ? extends Iterable<Edge>> barriersByLevel,
            int level
    ) {
        if (barriersByLevel == null || !barriersByLevel.containsKey(level)) {
            return Set.of();
        }
        Iterable<Edge> barriers = barriersByLevel.get(level);
        Set<EdgeKey> result = new LinkedHashSet<>();
        for (Edge barrier : barriers == null ? List.<Edge>of() : barriers) {
            if (barrier != null && barrier.from().level() == level && barrier.to().level() == level) {
                result.add(EdgeKey.from(barrier));
            }
        }
        return Set.copyOf(result);
    }

    static List<Set<Cell>> connectedComponents(
            Iterable<Cell> cells,
            Set<EdgeKey> barriers
    ) {
        Set<Cell> remaining = cellSet(cells);
        List<Set<Cell>> components = new ArrayList<>();
        while (!remaining.isEmpty()) {
            Set<Cell> component = reachableCells(remaining.iterator().next(), remaining, barriers);
            remaining.removeAll(component);
            components.add(component);
        }
        return List.copyOf(components);
    }

    static Set<Cell> reachableCells(
            @Nullable Cell anchor,
            Set<Cell> traversableCells,
            Set<EdgeKey> barriers
    ) {
        if (anchor == null) {
            return Set.of();
        }
        Set<Cell> visited = new LinkedHashSet<>();
        Set<Cell> frontier = new LinkedHashSet<>(traversableCells == null ? Set.<Cell>of() : traversableCells);
        Deque<Cell> queue = new ArrayDeque<>();
        queue.add(anchor);
        frontier.remove(anchor);
        while (!queue.isEmpty()) {
            Cell current = queue.removeFirst();
            visited.add(current);
            enqueueNeighbors(queue, frontier, barriers, current);
        }
        return Set.copyOf(visited);
    }

    private static void enqueueNeighbors(
            Deque<Cell> queue,
            Set<Cell> frontier,
            Set<EdgeKey> barriers,
            Cell current
    ) {
        for (Direction direction : Direction.values()) {
            Cell neighbor = direction.neighborOf(current);
            if (!frontier.contains(neighbor) || isBlocked(barriers, current, neighbor)) {
                continue;
            }
            frontier.remove(neighbor);
            queue.addLast(neighbor);
        }
    }

    private static boolean isBlocked(
            Set<EdgeKey> barriers,
            Cell current,
            Cell neighbor
    ) {
        if (barriers.isEmpty()) {
            return false;
        }
        Edge movementEdge = edgeBetweenAdjacentCells(current, neighbor);
        return movementEdge != null && barriers.contains(EdgeKey.from(movementEdge));
    }

    private static @Nullable Edge edgeBetweenAdjacentCells(Cell current, Cell neighbor) {
        if (current == null || neighbor == null || current.level() != neighbor.level()) {
            return null;
        }
        int deltaQ = neighbor.q() - current.q();
        int deltaR = neighbor.r() - current.r();
        for (Direction direction : Direction.values()) {
            if (direction.deltaQ() == deltaQ && direction.deltaR() == deltaR) {
                return Edge.sideOf(current, direction);
            }
        }
        return null;
    }

    private static Set<Cell> cellSet(Iterable<Cell> cells) {
        Set<Cell> result = new LinkedHashSet<>();
        for (Cell cell : cells == null ? List.<Cell>of() : cells) {
            if (cell != null) {
                result.add(cell);
            }
        }
        return result;
    }

}
