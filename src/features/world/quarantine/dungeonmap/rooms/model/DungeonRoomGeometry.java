package features.world.quarantine.dungeonmap.rooms.model;

import features.world.quarantine.dungeonmap.foundation.geometry.Point2i;

import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

public final class DungeonRoomGeometry {

    private static final List<Point2i> STANDARD_ROOM_VERTICES = List.of(
            new Point2i(-2, -1),
            new Point2i(2, -1),
            new Point2i(2, 1),
            new Point2i(-2, 1));

    private DungeonRoomGeometry() {
        throw new AssertionError("No instances");
    }

    public static List<Point2i> standardRoomVertices() {
        return STANDARD_ROOM_VERTICES;
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
        List<List<Point2i>> outlines = DungeonOutlineTracer.outlineLoopsForCells(normalizedCells);
        Point2i center = preferredCenter == null ? centerForCells(normalizedCells) : preferredCenter;
        List<Point2i> absoluteVertices = encodeLoops(outlines);
        List<Point2i> relativeVertices = absoluteVertices.stream()
                .map(point -> point.equals(DungeonCellPolygonMath.LOOP_SEPARATOR)
                        ? DungeonCellPolygonMath.LOOP_SEPARATOR
                        : point.subtract(center))
                .toList();
        return new RoomShape(center, relativeVertices, absoluteVertices, normalizedCells);
    }

    public static int componentDistance(DungeonRoom room, Point2i cell) {
        return room == null || cell == null ? Integer.MAX_VALUE : room.componentAnchor().distanceTo(cell);
    }

    public static int componentDistance(DungeonRoom left, DungeonRoom right) {
        return left == null || right == null ? Integer.MAX_VALUE : componentDistance(left, right.componentAnchor());
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

    private static List<Point2i> encodeLoops(List<List<Point2i>> loops) {
        List<Point2i> encoded = new ArrayList<>();
        for (int i = 0; i < loops.size(); i++) {
            if (i > 0) {
                encoded.add(DungeonCellPolygonMath.LOOP_SEPARATOR);
            }
            encoded.addAll(loops.get(i));
        }
        return List.copyOf(encoded);
    }
}
