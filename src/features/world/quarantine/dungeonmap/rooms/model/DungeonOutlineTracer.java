package features.world.quarantine.dungeonmap.rooms.model;

import features.world.quarantine.dungeonmap.foundation.geometry.Point2i;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static features.world.quarantine.dungeonmap.rooms.model.DungeonRoomCluster.EdgeDirection.EAST;
import static features.world.quarantine.dungeonmap.rooms.model.DungeonRoomCluster.EdgeDirection.NORTH;
import static features.world.quarantine.dungeonmap.rooms.model.DungeonRoomCluster.EdgeDirection.SOUTH;
import static features.world.quarantine.dungeonmap.rooms.model.DungeonRoomCluster.EdgeDirection.WEST;

final class DungeonOutlineTracer {

    // Prefer left turns to trace clockwise outlines; straight to minimize corners; right as fallback; back only when trapped.
    private static final int TURN_LEFT     = 0;
    private static final int TURN_STRAIGHT = 1;
    private static final int TURN_RIGHT    = 2;
    private static final int TURN_BACK     = 3;

    private static final Map<Point2i, Map<Point2i, Integer>> TURN_RANK_TABLE = buildTurnRankTable();

    private DungeonOutlineTracer() {
        throw new AssertionError("No instances");
    }

    static List<List<Point2i>> outlineLoopsForCells(Set<Point2i> cells) {
        Map<Point2i, List<DirectedEdge>> edgesByStart = buildDirectedEdges(cells);
        List<List<Point2i>> loops = traceAllLoops(edgesByStart);
        if (loops.isEmpty()) {
            // Single-cell clusters have no boundary edges; emit a unit rectangle.
            int minX = cells.stream().mapToInt(Point2i::x).min().orElse(0);
            int maxX = cells.stream().mapToInt(Point2i::x).max().orElse(minX);
            int minY = cells.stream().mapToInt(Point2i::y).min().orElse(0);
            int maxY = cells.stream().mapToInt(Point2i::y).max().orElse(minY);
            return List.of(List.of(
                    new Point2i(minX, minY), new Point2i(maxX + 1, minY),
                    new Point2i(maxX + 1, maxY + 1), new Point2i(minX, maxY + 1)));
        }
        return loops.stream()
                .sorted(Comparator.comparingDouble((List<Point2i> loop) -> Math.abs(signedArea(loop))).reversed())
                .toList();
    }

    private static Map<Point2i, List<DirectedEdge>> buildDirectedEdges(Set<Point2i> cells) {
        Map<EdgeKey, DirectedEdge> dedup = new HashMap<>();
        for (Point2i cell : cells) {
            maybeAddEdge(cells, dedup, cell, NORTH,
                    new Point2i(cell.x(), cell.y()), new Point2i(cell.x() + 1, cell.y()));
            maybeAddEdge(cells, dedup, cell, EAST,
                    new Point2i(cell.x() + 1, cell.y()), new Point2i(cell.x() + 1, cell.y() + 1));
            maybeAddEdge(cells, dedup, cell, SOUTH,
                    new Point2i(cell.x() + 1, cell.y() + 1), new Point2i(cell.x(), cell.y() + 1));
            maybeAddEdge(cells, dedup, cell, WEST,
                    new Point2i(cell.x(), cell.y() + 1), new Point2i(cell.x(), cell.y()));
        }
        Map<Point2i, List<DirectedEdge>> edgesByStart = new HashMap<>();
        for (DirectedEdge edge : dedup.values()) {
            edgesByStart.computeIfAbsent(edge.start(), ignored -> new ArrayList<>()).add(edge);
        }
        return edgesByStart;
    }

    private static void maybeAddEdge(
            Set<Point2i> cells,
            Map<EdgeKey, DirectedEdge> edges,
            Point2i cell,
            DungeonRoomCluster.EdgeDirection direction,
            Point2i start,
            Point2i end
    ) {
        if (!cells.contains(cell.add(direction.delta()))) {
            edges.put(new EdgeKey(start, end), new DirectedEdge(start, end));
        }
    }

    private static List<List<Point2i>> traceAllLoops(Map<Point2i, List<DirectedEdge>> edgesByStart) {
        Set<DirectedEdge> visited = new HashSet<>();
        List<List<Point2i>> loops = new ArrayList<>();
        for (List<DirectedEdge> edges : edgesByStart.values()) {
            for (DirectedEdge edge : edges) {
                if (!visited.contains(edge)) {
                    loops.add(traceLoop(edge, edgesByStart, visited));
                }
            }
        }
        return loops;
    }

    private static List<Point2i> traceLoop(
            DirectedEdge startEdge,
            Map<Point2i, List<DirectedEdge>> outgoing,
            Set<DirectedEdge> visited
    ) {
        List<Point2i> loop = new ArrayList<>();
        DirectedEdge current = startEdge;
        visited.add(current);
        loop.add(current.start());
        while (true) {
            loop.add(current.end());
            if (current.end().equals(startEdge.start())) {
                loop.remove(loop.size() - 1);
                return List.copyOf(loop);
            }
            DirectedEdge next = chooseNextEdge(current, outgoing.getOrDefault(current.end(), List.of()), visited);
            if (next == null) {
                return List.copyOf(loop);
            }
            visited.add(next);
            current = next;
        }
    }

    private static DirectedEdge chooseNextEdge(
            DirectedEdge current,
            List<DirectedEdge> candidates,
            Set<DirectedEdge> visited
    ) {
        DirectedEdge best = null;
        int bestRank = Integer.MAX_VALUE;
        Point2i currentVector = current.vector();
        for (DirectedEdge candidate : candidates) {
            if (visited.contains(candidate)) {
                continue;
            }
            int rank = turnRank(currentVector, candidate.vector());
            if (rank < bestRank) {
                best = candidate;
                bestRank = rank;
            }
        }
        return best;
    }

    private static Map<Point2i, Map<Point2i, Integer>> buildTurnRankTable() {
        Map<Point2i, Map<Point2i, Integer>> table = new HashMap<>();
        for (DungeonRoomCluster.EdgeDirection from : DungeonRoomCluster.EdgeDirection.values()) {
            Map<Point2i, Integer> row = new HashMap<>();
            for (DungeonRoomCluster.EdgeDirection to : DungeonRoomCluster.EdgeDirection.values()) {
                Point2i f = from.delta();
                Point2i t = to.delta();
                int cross = f.x() * t.y() - f.y() * t.x();
                int dot = f.x() * t.x() + f.y() * t.y();
                int rank = cross > 0 ? TURN_LEFT : (cross == 0 && dot > 0) ? TURN_STRAIGHT : cross < 0 ? TURN_RIGHT : TURN_BACK;
                row.put(t, rank);
            }
            table.put(from.delta(), Map.copyOf(row));
        }
        return Map.copyOf(table);
    }

    private static int turnRank(Point2i from, Point2i to) {
        return TURN_RANK_TABLE.get(from).get(to);
    }

    static double signedArea(List<Point2i> loop) {
        double area = 0;
        for (int i = 0; i < loop.size(); i++) {
            Point2i current = loop.get(i);
            Point2i next = loop.get((i + 1) % loop.size());
            area += (double) current.x() * next.y() - (double) next.x() * current.y();
        }
        return area / 2.0;
    }

    private record EdgeKey(Point2i start, Point2i end) {
    }

    private record DirectedEdge(Point2i start, Point2i end) {
        private Point2i vector() {
            return end.subtract(start);
        }
    }
}
