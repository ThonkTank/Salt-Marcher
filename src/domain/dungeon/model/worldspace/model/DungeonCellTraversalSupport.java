package src.domain.dungeon.model.worldspace.model;

import org.jspecify.annotations.Nullable;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

final class DungeonCellTraversalSupport {

    List<Set<DungeonCell>> connectedComponents(Iterable<DungeonCell> cells) {
        return connectedComponents(cells, List.of(), null);
    }

    List<Set<DungeonCell>> connectedComponents(
            Iterable<DungeonCell> cells,
            List<DungeonClusterBoundary> barriers,
            @Nullable DungeonCell center
    ) {
        Set<DungeonCell> remaining = cellSet(cells);
        List<Set<DungeonCell>> components = new ArrayList<>();
        while (!remaining.isEmpty()) {
            components.add(floodComponent(remaining.iterator().next(), remaining, barriers, center));
        }
        return List.copyOf(components);
    }

    Set<DungeonCell> reachableCells(
            DungeonCell anchor,
            Set<DungeonCell> traversableCells,
            List<DungeonClusterBoundary> barriers,
            @Nullable DungeonCell center
    ) {
        if (anchor == null) {
            return Set.of();
        }
        Set<DungeonCell> visited = new LinkedHashSet<>();
        Set<DungeonCell> frontier = new LinkedHashSet<>(traversableCells == null ? Set.<DungeonCell>of() : traversableCells);
        Deque<DungeonCell> queue = new ArrayDeque<>();
        queue.add(anchor);
        frontier.remove(anchor);
        while (!queue.isEmpty()) {
            DungeonCell current = queue.removeFirst();
            visited.add(current);
            for (DungeonEdgeDirection direction : DungeonEdgeDirection.values()) {
                DungeonCell neighbor = direction.neighborOf(current);
                if (!frontier.contains(neighbor) || isBlocked(barriers, center, current, neighbor)) {
                    continue;
                }
                frontier.remove(neighbor);
                queue.addLast(neighbor);
            }
        }
        return Set.copyOf(visited);
    }

    private static Set<DungeonCell> floodComponent(
            DungeonCell start,
            Set<DungeonCell> remaining,
            List<DungeonClusterBoundary> barriers,
            @Nullable DungeonCell center
    ) {
        Set<DungeonCell> component = new LinkedHashSet<>();
        Set<DungeonCell> frontier = new LinkedHashSet<>(remaining);
        Deque<DungeonCell> queue = new ArrayDeque<>();
        queue.add(start);
        frontier.remove(start);
        remaining.remove(start);
        while (!queue.isEmpty()) {
            DungeonCell current = queue.removeFirst();
            component.add(current);
            enqueueNeighbors(queue, frontier, remaining, barriers, center, current);
        }
        return Set.copyOf(component);
    }

    private static void enqueueNeighbors(
            Deque<DungeonCell> queue,
            Set<DungeonCell> frontier,
            Set<DungeonCell> remaining,
            List<DungeonClusterBoundary> barriers,
            @Nullable DungeonCell center,
            DungeonCell current
    ) {
        for (DungeonEdgeDirection direction : DungeonEdgeDirection.values()) {
            DungeonCell neighbor = direction.neighborOf(current);
            if (!frontier.contains(neighbor) || isBlocked(barriers, center, current, neighbor)) {
                continue;
            }
            frontier.remove(neighbor);
            remaining.remove(neighbor);
            queue.addLast(neighbor);
        }
    }

    private static Set<DungeonCell> cellSet(Iterable<DungeonCell> cells) {
        Set<DungeonCell> result = new LinkedHashSet<>();
        for (DungeonCell cell : cells == null ? List.<DungeonCell>of() : cells) {
            if (cell != null) {
                result.add(cell);
            }
        }
        return result;
    }

    private static boolean isBlocked(
            List<DungeonClusterBoundary> barriers,
            @Nullable DungeonCell center,
            DungeonCell current,
            DungeonCell neighbor
    ) {
        if (center == null || barriers == null || barriers.isEmpty()) {
            return false;
        }
        DungeonEdge movementEdge = edgeBetweenAdjacentCells(current, neighbor);
        if (movementEdge == null) {
            return false;
        }
        DungeonBoundaryKey movement = DungeonBoundaryKey.from(movementEdge);
        for (DungeonClusterBoundary barrier : barriers) {
            if (barrier != null && !barrier.isOpen()
                    && DungeonBoundaryKey.from(barrier.absoluteEdge(center)).equals(movement)) {
                return true;
            }
        }
        return false;
    }

    private static @Nullable DungeonEdge edgeBetweenAdjacentCells(DungeonCell current, DungeonCell neighbor) {
        if (current == null || neighbor == null || current.level() != neighbor.level()) {
            return null;
        }
        int deltaQ = neighbor.q() - current.q();
        int deltaR = neighbor.r() - current.r();
        for (DungeonEdgeDirection direction : DungeonEdgeDirection.values()) {
            if (direction.deltaQ() == deltaQ && direction.deltaR() == deltaR) {
                return DungeonEdge.sideOf(current, direction);
            }
        }
        return null;
    }
}
