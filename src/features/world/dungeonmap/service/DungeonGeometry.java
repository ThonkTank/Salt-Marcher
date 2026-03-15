package features.world.dungeonmap.service;

import features.world.dungeonmap.model.DungeonCorridor;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.DungeonRoom;
import features.world.dungeonmap.model.Point2i;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.PriorityQueue;
import java.util.Set;

public final class DungeonGeometry {

    private static final List<Point2i> STANDARD_ROOM_VERTICES = List.of(
            new Point2i(-2, -1),
            new Point2i(2, -1),
            new Point2i(2, 1),
            new Point2i(-2, 1));
    private static final List<Point2i> CARDINAL_NEIGHBORS = List.of(
            new Point2i(1, 0),
            new Point2i(-1, 0),
            new Point2i(0, 1),
            new Point2i(0, -1));

    private DungeonGeometry() {
        throw new AssertionError("No instances");
    }

    public static List<Point2i> standardRoomVertices() {
        return STANDARD_ROOM_VERTICES;
    }

    public static Set<Point2i> roomCells(DungeonRoom room) {
        Objects.requireNonNull(room, "room");
        List<Point2i> polygon = absolutePolygon(room);
        int minX = polygon.stream().mapToInt(Point2i::x).min().orElse(room.center().x());
        int maxX = polygon.stream().mapToInt(Point2i::x).max().orElse(room.center().x());
        int minY = polygon.stream().mapToInt(Point2i::y).min().orElse(room.center().y());
        int maxY = polygon.stream().mapToInt(Point2i::y).max().orElse(room.center().y());

        Set<Point2i> cells = new HashSet<>();
        for (int x = minX; x <= maxX; x++) {
            for (int y = minY; y <= maxY; y++) {
                if (polygonContainsCell(polygon, x, y)) {
                    cells.add(new Point2i(x, y));
                }
            }
        }
        if (cells.isEmpty()) {
            cells.add(room.center());
        }
        return cells;
    }

    public static List<Point2i> absolutePolygon(DungeonRoom room) {
        List<Point2i> result = new ArrayList<>();
        for (Point2i relative : room.relativeVertices()) {
            result.add(room.center().add(relative));
        }
        return result;
    }

    public static Map<Long, List<Point2i>> corridorPaths(DungeonLayout layout) {
        Map<Long, DungeonRoom> roomsById = roomsById(layout.rooms());
        Map<Point2i, Long> roomOccupancy = new HashMap<>();
        for (DungeonRoom room : layout.rooms()) {
            for (Point2i cell : roomCells(room)) {
                roomOccupancy.put(cell, room.roomId());
            }
        }

        Map<Long, List<Point2i>> result = new HashMap<>();
        for (DungeonCorridor corridor : layout.corridors()) {
            DungeonRoom from = roomsById.get(corridor.fromRoomId());
            DungeonRoom to = roomsById.get(corridor.toRoomId());
            if (from == null || to == null) {
                continue;
            }
            result.put(corridor.corridorId(), shortestPath(from.center(), to.center(), roomOccupancy, from.roomId(), to.roomId()));
        }
        return result;
    }

    public static Point2i suggestNewRoomCenter(Collection<DungeonRoom> rooms) {
        if (rooms.isEmpty()) {
            return new Point2i(0, 0);
        }
        int maxX = rooms.stream().mapToInt(room -> room.center().x()).max().orElse(0);
        int minY = rooms.stream().mapToInt(room -> room.center().y()).min().orElse(0);
        return new Point2i(maxX + 8, minY);
    }

    private static List<Point2i> shortestPath(
            Point2i start,
            Point2i goal,
            Map<Point2i, Long> roomOccupancy,
            long allowedStartRoomId,
            long allowedGoalRoomId
    ) {
        int padding = 6;
        int minX = Math.min(start.x(), goal.x()) - padding;
        int maxX = Math.max(start.x(), goal.x()) + padding;
        int minY = Math.min(start.y(), goal.y()) - padding;
        int maxY = Math.max(start.y(), goal.y()) + padding;
        for (Point2i point : roomOccupancy.keySet()) {
            minX = Math.min(minX, point.x() - 2);
            maxX = Math.max(maxX, point.x() + 2);
            minY = Math.min(minY, point.y() - 2);
            maxY = Math.max(maxY, point.y() + 2);
        }

        record Node(Point2i point, int cost, int priority) {}
        PriorityQueue<Node> open = new PriorityQueue<>(Comparator.comparingInt(Node::priority));
        Map<Point2i, Point2i> previous = new HashMap<>();
        Map<Point2i, Integer> costByPoint = new HashMap<>();
        open.add(new Node(start, 0, manhattan(start, goal)));
        costByPoint.put(start, 0);

        while (!open.isEmpty()) {
            Node node = open.poll();
            if (node.point().equals(goal)) {
                return reconstructPath(goal, previous);
            }
            for (Point2i direction : CARDINAL_NEIGHBORS) {
                Point2i next = node.point().add(direction);
                if (next.x() < minX || next.x() > maxX || next.y() < minY || next.y() > maxY) {
                    continue;
                }
                Long occupiedRoomId = roomOccupancy.get(next);
                if (occupiedRoomId != null
                        && occupiedRoomId != allowedStartRoomId
                        && occupiedRoomId != allowedGoalRoomId) {
                    continue;
                }
                int nextCost = node.cost() + 1;
                Integer existing = costByPoint.get(next);
                if (existing != null && existing <= nextCost) {
                    continue;
                }
                previous.put(next, node.point());
                costByPoint.put(next, nextCost);
                open.add(new Node(next, nextCost, nextCost + manhattan(next, goal)));
            }
        }

        return List.of(start, goal);
    }

    private static int manhattan(Point2i a, Point2i b) {
        return Math.abs(a.x() - b.x()) + Math.abs(a.y() - b.y());
    }

    private static List<Point2i> reconstructPath(Point2i goal, Map<Point2i, Point2i> previous) {
        ArrayDeque<Point2i> path = new ArrayDeque<>();
        Point2i cursor = goal;
        path.addFirst(cursor);
        while (previous.containsKey(cursor)) {
            cursor = previous.get(cursor);
            path.addFirst(cursor);
        }
        return List.copyOf(path);
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

    private static Map<Long, DungeonRoom> roomsById(List<DungeonRoom> rooms) {
        Map<Long, DungeonRoom> result = new HashMap<>();
        for (DungeonRoom room : rooms) {
            if (room.roomId() != null) {
                result.put(room.roomId(), room);
            }
        }
        return result;
    }
}
