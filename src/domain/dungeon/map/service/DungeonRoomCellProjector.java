package src.domain.dungeon.map.service;

import src.domain.dungeon.map.entity.DungeonRoom;
import src.domain.dungeon.map.entity.DungeonRoomCluster;
import src.domain.dungeon.map.value.DungeonCell;
import src.domain.dungeon.map.value.DungeonClusterBoundary;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

public final class DungeonRoomCellProjector {

    public static final DungeonCell LOOP_SEPARATOR = new DungeonCell(Integer.MIN_VALUE, Integer.MIN_VALUE, 0);

    public Map<Long, List<DungeonCell>> cellsByRoom(
            DungeonRoomCluster cluster,
            List<DungeonRoom> rooms
    ) {
        Map<Long, List<DungeonCell>> result = new LinkedHashMap<>();
        Set<Integer> levels = levels(cluster, rooms);
        for (Integer level : levels) {
            Set<DungeonCell> clusterCells = new LinkedHashSet<>(clusterCells(cluster, rooms, level));
            Set<DungeonCell> unclaimedCells = new LinkedHashSet<>(clusterCells);
            List<DungeonClusterBoundary> barriers = cluster.boundariesByLevel().getOrDefault(level, List.of());
            for (DungeonRoom room : rooms == null ? List.<DungeonRoom>of() : rooms) {
                DungeonCell anchor = room.floorAnchors().get(level);
                if (anchor == null) {
                    continue;
                }
                if (!clusterCells.contains(anchor)) {
                    clusterCells.add(anchor);
                    unclaimedCells.add(anchor);
                } else if (!unclaimedCells.contains(anchor)) {
                    result.computeIfAbsent(room.roomId(), ignored -> new ArrayList<>()).add(anchor);
                    continue;
                }
                Set<DungeonCell> reachable = reachableCells(anchor, unclaimedCells, barriers, cluster.center());
                if (reachable.isEmpty()) {
                    reachable = Set.of(anchor);
                }
                unclaimedCells.removeAll(reachable);
                result.computeIfAbsent(room.roomId(), ignored -> new ArrayList<>()).addAll(reachable);
            }
        }
        for (DungeonRoom room : rooms == null ? List.<DungeonRoom>of() : rooms) {
            result.computeIfAbsent(room.roomId(), ignored -> new ArrayList<>()).add(room.primaryAnchor());
        }
        return normalizeCellsByRoom(result);
    }

    public Map<Integer, List<DungeonCell>> cellsByLevel(
            DungeonRoomCluster cluster,
            List<DungeonRoom> rooms
    ) {
        Map<Integer, List<DungeonCell>> result = new LinkedHashMap<>();
        for (Integer level : levels(cluster, rooms)) {
            result.put(level, sortedCells(clusterCells(cluster, rooms, level)));
        }
        return Map.copyOf(result);
    }

    public Set<DungeonCell> clusterCells(
            DungeonRoomCluster cluster,
            List<DungeonRoom> rooms,
            int level
    ) {
        List<DungeonCell> vertices = cluster.relativeVerticesByLevel().getOrDefault(level, List.of());
        if (!vertices.isEmpty()) {
            return cellsFromRelativeVertices(cluster.center(), level, vertices);
        }
        Set<DungeonCell> anchors = new LinkedHashSet<>();
        for (DungeonRoom room : rooms == null ? List.<DungeonRoom>of() : rooms) {
            DungeonCell anchor = room.floorAnchors().get(level);
            if (anchor != null) {
                anchors.add(anchor);
            }
        }
        if (anchors.isEmpty()) {
            anchors.add(new DungeonCell(cluster.center().q(), cluster.center().r(), level));
        }
        return anchors;
    }

    public List<DungeonCell> relativeCellLoops(DungeonCell center, List<DungeonCell> cells) {
        if (center == null || cells == null || cells.isEmpty()) {
            return List.of();
        }
        List<DungeonCell> vertices = new ArrayList<>();
        for (DungeonCell cell : sortedCells(cells)) {
            int q = cell.q() - center.q();
            int r = cell.r() - center.r();
            vertices.add(new DungeonCell(q, r, cell.level()));
            vertices.add(new DungeonCell(q + 1, r, cell.level()));
            vertices.add(new DungeonCell(q + 1, r + 1, cell.level()));
            vertices.add(new DungeonCell(q, r + 1, cell.level()));
            vertices.add(LOOP_SEPARATOR);
        }
        return List.copyOf(vertices);
    }

    public List<Set<DungeonCell>> connectedComponents(Set<DungeonCell> cells) {
        Set<DungeonCell> remaining = new LinkedHashSet<>(cells == null ? Set.<DungeonCell>of() : cells);
        List<Set<DungeonCell>> components = new ArrayList<>();
        while (!remaining.isEmpty()) {
            DungeonCell start = remaining.iterator().next();
            Set<DungeonCell> component = new LinkedHashSet<>();
            ArrayDeque<DungeonCell> queue = new ArrayDeque<>();
            queue.add(start);
            remaining.remove(start);
            while (!queue.isEmpty()) {
                DungeonCell current = queue.removeFirst();
                component.add(current);
                for (DirectionStep step : DirectionStep.CARDINAL) {
                    DungeonCell neighbor = step.neighbor(current);
                    if (remaining.remove(neighbor)) {
                        queue.addLast(neighbor);
                    }
                }
            }
            components.add(Set.copyOf(component));
        }
        components.sort(Comparator
                .comparingInt((Set<DungeonCell> component) -> component.stream()
                        .mapToInt(DungeonCell::level)
                        .min()
                        .orElse(0))
                .thenComparingInt(component -> component.stream().mapToInt(DungeonCell::r).min().orElse(0))
                .thenComparingInt(component -> component.stream().mapToInt(DungeonCell::q).min().orElse(0)));
        return List.copyOf(components);
    }

    public static Map<Integer, DungeonCell> anchorsByLevel(Map<Integer, List<DungeonCell>> cellsByLevel) {
        Map<Integer, DungeonCell> result = new LinkedHashMap<>();
        for (Map.Entry<Integer, List<DungeonCell>> entry : cellsByLevel.entrySet()) {
            if (!entry.getValue().isEmpty()) {
                result.put(entry.getKey(), sortedCells(entry.getValue()).getFirst());
            }
        }
        return Map.copyOf(result);
    }

    private static Map<Long, List<DungeonCell>> normalizeCellsByRoom(Map<Long, List<DungeonCell>> source) {
        Map<Long, List<DungeonCell>> normalized = new LinkedHashMap<>();
        for (Map.Entry<Long, List<DungeonCell>> entry : source.entrySet()) {
            normalized.put(entry.getKey(), sortedCells(entry.getValue()));
        }
        return Map.copyOf(normalized);
    }

    private static Set<Integer> levels(DungeonRoomCluster cluster, List<DungeonRoom> rooms) {
        Set<Integer> levels = new LinkedHashSet<>();
        levels.add(cluster.center().level());
        levels.addAll(cluster.relativeVerticesByLevel().keySet());
        levels.addAll(cluster.boundariesByLevel().keySet());
        for (DungeonRoom room : rooms == null ? List.<DungeonRoom>of() : rooms) {
            levels.addAll(room.floorAnchors().keySet());
        }
        return levels;
    }

    private static Set<DungeonCell> cellsFromRelativeVertices(
            DungeonCell center,
            int level,
            List<DungeonCell> relativeVertices
    ) {
        List<List<DungeonCell>> loops = splitLoops(relativeVertices);
        if (loops.isEmpty()) {
            return Set.of(new DungeonCell(center.q(), center.r(), level));
        }
        int minQ = loops.stream().flatMap(List::stream).mapToInt(DungeonCell::q).min().orElse(0);
        int maxQ = loops.stream().flatMap(List::stream).mapToInt(DungeonCell::q).max().orElse(0);
        int minR = loops.stream().flatMap(List::stream).mapToInt(DungeonCell::r).min().orElse(0);
        int maxR = loops.stream().flatMap(List::stream).mapToInt(DungeonCell::r).max().orElse(0);
        Set<DungeonCell> cells = new LinkedHashSet<>();
        for (int q = minQ; q <= maxQ; q++) {
            for (int r = minR; r <= maxR; r++) {
                if (containsCell(loops, q, r)) {
                    cells.add(new DungeonCell(center.q() + q, center.r() + r, level));
                }
            }
        }
        return cells.isEmpty() ? Set.of(new DungeonCell(center.q(), center.r(), level)) : cells;
    }

    private static List<List<DungeonCell>> splitLoops(List<DungeonCell> vertices) {
        List<List<DungeonCell>> loops = new ArrayList<>();
        List<DungeonCell> currentLoop = new ArrayList<>();
        for (DungeonCell vertex : vertices == null ? List.<DungeonCell>of() : vertices) {
            if (LOOP_SEPARATOR.equals(vertex)) {
                if (!currentLoop.isEmpty()) {
                    loops.add(List.copyOf(currentLoop));
                    currentLoop = new ArrayList<>();
                }
                continue;
            }
            currentLoop.add(vertex);
        }
        if (!currentLoop.isEmpty()) {
            loops.add(List.copyOf(currentLoop));
        }
        return List.copyOf(loops);
    }

    private static boolean containsCell(List<List<DungeonCell>> loops, int q, int r) {
        boolean inside = false;
        for (List<DungeonCell> loop : loops) {
            if (polygonContainsCell(loop, q, r)) {
                inside = !inside;
            }
        }
        return inside;
    }

    private static boolean polygonContainsCell(List<DungeonCell> polygon, int q, int r) {
        double px = q + 0.5D;
        double py = r + 0.5D;
        boolean inside = false;
        for (int i = 0, j = polygon.size() - 1; i < polygon.size(); j = i++) {
            DungeonCell pi = polygon.get(i);
            DungeonCell pj = polygon.get(j);
            boolean intersects = ((pi.r() > py) != (pj.r() > py))
                    && (px < (double) (pj.q() - pi.q()) * (py - pi.r()) / (double) (pj.r() - pi.r()) + pi.q());
            if (intersects) {
                inside = !inside;
            }
        }
        return inside;
    }

    private static Set<DungeonCell> reachableCells(
            DungeonCell anchor,
            Set<DungeonCell> traversableCells,
            List<DungeonClusterBoundary> barriers,
            DungeonCell center
    ) {
        Set<DungeonCell> visited = new LinkedHashSet<>();
        Set<DungeonCell> frontier = new LinkedHashSet<>(traversableCells);
        ArrayDeque<DungeonCell> queue = new ArrayDeque<>();
        queue.add(anchor);
        frontier.remove(anchor);
        while (!queue.isEmpty()) {
            DungeonCell current = queue.removeFirst();
            visited.add(current);
            for (DirectionStep step : DirectionStep.CARDINAL) {
                DungeonCell neighbor = step.neighbor(current);
                if (!frontier.contains(neighbor) || isBlocked(barriers, center, current, step)) {
                    continue;
                }
                frontier.remove(neighbor);
                queue.addLast(neighbor);
            }
        }
        return Set.copyOf(visited);
    }

    private static boolean isBlocked(
            List<DungeonClusterBoundary> barriers,
            DungeonCell center,
            DungeonCell cell,
            DirectionStep step
    ) {
        for (DungeonClusterBoundary barrier : barriers) {
            if (crosses(barrier, center, cell, step)) {
                return true;
            }
        }
        return false;
    }

    private static boolean crosses(
            DungeonClusterBoundary boundary,
            DungeonCell center,
            DungeonCell cell,
            DirectionStep step
    ) {
        DungeonCell from = boundary.absoluteCell(center);
        DungeonCell to = boundary.direction().neighborOf(from);
        DungeonCell neighbor = step.neighbor(cell);
        return (from.equals(cell) && to.equals(neighbor)) || (from.equals(neighbor) && to.equals(cell));
    }

    public static List<DungeonCell> sortedCells(Iterable<DungeonCell> cells) {
        List<DungeonCell> result = new ArrayList<>();
        for (DungeonCell cell : cells == null ? List.<DungeonCell>of() : cells) {
            if (cell != null) {
                result.add(cell);
            }
        }
        return result.stream()
                .distinct()
                .sorted(Comparator
                        .comparingInt(DungeonCell::level)
                        .thenComparingInt(DungeonCell::r)
                        .thenComparingInt(DungeonCell::q))
                .toList();
    }

    private static final class DirectionStep {
        private final int deltaQ;
        private final int deltaR;

        private static final List<DirectionStep> CARDINAL = List.of(
                new DirectionStep(0, -1),
                new DirectionStep(1, 0),
                new DirectionStep(0, 1),
                new DirectionStep(-1, 0));

        private DirectionStep(int deltaQ, int deltaR) {
            this.deltaQ = deltaQ;
            this.deltaR = deltaR;
        }

        DungeonCell neighbor(DungeonCell cell) {
            return new DungeonCell(cell.q() + deltaQ, cell.r() + deltaR, cell.level());
        }
    }
}
