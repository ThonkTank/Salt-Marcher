package features.world.dungeonmap.rooms.model;
import features.world.dungeonmap.foundation.geometry.Point2i;


import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

import static features.world.dungeonmap.rooms.model.DungeonRoomCluster.EdgeDirection.EAST;
import static features.world.dungeonmap.rooms.model.DungeonRoomCluster.EdgeDirection.NORTH;
import static features.world.dungeonmap.rooms.model.DungeonRoomCluster.EdgeDirection.SOUTH;
import static features.world.dungeonmap.rooms.model.DungeonRoomCluster.EdgeDirection.WEST;

public final class DungeonRoomGeometry {

    private static final List<Point2i> STANDARD_ROOM_VERTICES = List.of(
            new Point2i(-2, -1),
            new Point2i(2, -1),
            new Point2i(2, 1),
            new Point2i(-2, 1));
    private static final Point2i LOOP_SEPARATOR = new Point2i(Integer.MIN_VALUE, Integer.MIN_VALUE);

    private static final Map<Point2i, Map<Point2i, Integer>> TURN_RANK_TABLE = buildTurnRankTable();

    private DungeonRoomGeometry() {
        throw new AssertionError("No instances");
    }

    public static List<Point2i> standardRoomVertices() {
        return STANDARD_ROOM_VERTICES;
    }

    public static Set<Point2i> cells(DungeonShape shape) {
        Objects.requireNonNull(shape, "shape");
        List<List<Point2i>> loops = absoluteLoops(shape);
        if (loops.isEmpty()) {
            return Set.of(shape.center());
        }
        int minX = loops.stream().flatMap(List::stream).mapToInt(Point2i::x).min().orElse(shape.center().x());
        int maxX = loops.stream().flatMap(List::stream).mapToInt(Point2i::x).max().orElse(shape.center().x());
        int minY = loops.stream().flatMap(List::stream).mapToInt(Point2i::y).min().orElse(shape.center().y());
        int maxY = loops.stream().flatMap(List::stream).mapToInt(Point2i::y).max().orElse(shape.center().y());

        Set<Point2i> cells = new HashSet<>();
        for (int x = minX; x <= maxX; x++) {
            for (int y = minY; y <= maxY; y++) {
                if (containsCell(loops, x, y)) {
                    cells.add(new Point2i(x, y));
                }
            }
        }
        if (cells.isEmpty()) {
            cells.add(shape.center());
        }
        return cells;
    }

    public static List<Point2i> absolutePolygon(DungeonShape shape) {
        return absoluteLoops(shape).stream()
                .max(Comparator.comparingDouble(loop -> Math.abs(signedArea(loop))))
                .map(List::copyOf)
                .orElse(List.of());
    }

    public static List<List<Point2i>> absoluteLoops(DungeonShape shape) {
        return decodeAbsoluteLoops(shape);
    }

    public static Set<Point2i> graphRoomCells(Point2i center) {
        Objects.requireNonNull(center, "center");
        Set<Point2i> cells = new LinkedHashSet<>();
        for (int x = center.x() - 1; x <= center.x() + 1; x++) {
            for (int y = center.y() - 1; y <= center.y() + 1; y++) {
                cells.add(new Point2i(x, y));
            }
        }
        return Set.copyOf(cells);
    }

    public static RoomShape roomShapeForCells(Collection<Point2i> cells) {
        return roomShapeForCells(cells, null);
    }

    public static RoomShape roomShapeForCells(Collection<Point2i> cells, Point2i preferredCenter) {
        Objects.requireNonNull(cells, "cells");
        if (cells.isEmpty()) {
            throw new IllegalArgumentException("cells darf nicht leer sein");
        }
        Set<Point2i> normalizedCells = Set.copyOf(cells);
        List<List<Point2i>> outlines = outlineLoopsForCells(normalizedCells);
        Point2i center = preferredCenter == null ? centerForCells(normalizedCells) : preferredCenter;
        List<Point2i> absoluteVertices = encodeLoops(outlines);
        List<Point2i> relativeVertices = absoluteVertices.stream()
                .map(point -> point.equals(LOOP_SEPARATOR) ? LOOP_SEPARATOR : point.subtract(center))
                .toList();
        return new RoomShape(center, relativeVertices, absoluteVertices, normalizedCells);
    }

    public static RoomShape findClusterComponentShape(
            Collection<RoomShape> componentShapes,
            Point2i componentAnchor
    ) {
        if (componentAnchor == null || componentShapes == null) {
            return null;
        }
        for (RoomShape shape : componentShapes) {
            if (shape != null && shape.cells().contains(componentAnchor)) {
                return shape;
            }
        }
        return null;
    }

    private static Point2i centerForCells(Set<Point2i> cells) {
        int sumX = 0;
        int sumY = 0;
        for (Point2i cell : cells) {
            sumX += cell.x();
            sumY += cell.y();
        }
        return new Point2i(Math.round((float) sumX / cells.size()), Math.round((float) sumY / cells.size()));
    }

    private static List<List<Point2i>> outlineLoopsForCells(Set<Point2i> cells) {
        Map<Point2i, List<DirectedEdge>> edgesByStart = buildDirectedEdges(cells);
        List<List<Point2i>> loops = traceAllLoops(edgesByStart);
        if (loops.isEmpty()) {
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
                int rank = cross > 0 ? 0 : (cross == 0 && dot > 0) ? 1 : cross < 0 ? 2 : 3;
                row.put(t, rank);
            }
            table.put(from.delta(), Map.copyOf(row));
        }
        return Map.copyOf(table);
    }

    private static int turnRank(Point2i from, Point2i to) {
        return TURN_RANK_TABLE.get(from).get(to);
    }

    private static double signedArea(List<Point2i> loop) {
        double area = 0;
        for (int i = 0; i < loop.size(); i++) {
            Point2i current = loop.get(i);
            Point2i next = loop.get((i + 1) % loop.size());
            area += (double) current.x() * next.y() - (double) next.x() * current.y();
        }
        return area / 2.0;
    }

    private static List<List<Point2i>> decodeAbsoluteLoops(DungeonShape shape) {
        List<List<Point2i>> loops = new ArrayList<>();
        List<Point2i> currentLoop = new ArrayList<>();
        for (Point2i relative : shape.relativeVertices()) {
            if (LOOP_SEPARATOR.equals(relative)) {
                if (!currentLoop.isEmpty()) {
                    loops.add(List.copyOf(currentLoop));
                    currentLoop = new ArrayList<>();
                }
                continue;
            }
            currentLoop.add(shape.center().add(relative));
        }
        if (!currentLoop.isEmpty()) {
            loops.add(List.copyOf(currentLoop));
        }
        if (!loops.isEmpty()) {
            return List.copyOf(loops);
        }

        List<Point2i> polygon = new ArrayList<>();
        for (Point2i relative : shape.relativeVertices()) {
            polygon.add(shape.center().add(relative));
        }
        return polygon.isEmpty() ? List.of() : List.of(List.copyOf(polygon));
    }

    private static boolean containsCell(List<List<Point2i>> loops, int x, int y) {
        boolean inside = false;
        for (List<Point2i> loop : loops) {
            if (polygonContainsCell(loop, x, y)) {
                inside = !inside;
            }
        }
        return inside;
    }

    private static List<Point2i> encodeLoops(List<List<Point2i>> loops) {
        List<Point2i> encoded = new ArrayList<>();
        for (int i = 0; i < loops.size(); i++) {
            if (i > 0) {
                encoded.add(LOOP_SEPARATOR);
            }
            encoded.addAll(loops.get(i));
        }
        return List.copyOf(encoded);
    }

    private static boolean polygonContainsCell(List<Point2i> polygon, int x, int y) {
        double px = x + 0.5;
        double py = y + 0.5;
        boolean inside = false;
        for (int i = 0, j = polygon.size() - 1; i < polygon.size(); j = i++) {
            Point2i pi = polygon.get(i);
            Point2i pj = polygon.get(j);
            boolean intersects = ((pi.y() > py) != (pj.y() > py))
                    && (px < (double) (pj.x() - pi.x()) * (py - pi.y()) / (double) (pj.y() - pi.y()) + pi.x());
            if (intersects) {
                inside = !inside;
            }
        }
        return inside;
    }

    private record EdgeKey(Point2i start, Point2i end) {
    }

    private record DirectedEdge(Point2i start, Point2i end) {
        private Point2i vector() {
            return end.subtract(start);
        }
    }
}
