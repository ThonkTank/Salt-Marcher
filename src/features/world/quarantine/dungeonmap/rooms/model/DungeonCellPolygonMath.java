package features.world.quarantine.dungeonmap.rooms.model;

import features.world.quarantine.dungeonmap.foundation.geometry.Point2i;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

public final class DungeonCellPolygonMath {

    public static final Point2i LOOP_SEPARATOR = new Point2i(Integer.MIN_VALUE, Integer.MIN_VALUE);

    private DungeonCellPolygonMath() {
        throw new AssertionError("No instances");
    }

    public static Set<Point2i> cells(DungeonShape shape) {
        Objects.requireNonNull(shape, "shape");
        List<List<Point2i>> loops = absoluteLoops(shape);
        if (loops.isEmpty()) {
            return Set.of(shape.center());
        }
        int minX = shape.center().x(), maxX = minX, minY = shape.center().y(), maxY = minY;
        for (List<Point2i> loop : loops) {
            for (Point2i p : loop) {
                if (p.x() < minX) minX = p.x();
                if (p.x() > maxX) maxX = p.x();
                if (p.y() < minY) minY = p.y();
                if (p.y() > maxY) maxY = p.y();
            }
        }

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
                .max(Comparator.comparingDouble(loop -> Math.abs(DungeonOutlineTracer.signedArea(loop))))
                .map(List::copyOf)
                .orElse(List.of());
    }

    public static List<List<Point2i>> absoluteLoops(DungeonShape shape) {
        return decodeAbsoluteLoops(shape);
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
        return loops.isEmpty() ? List.of() : List.copyOf(loops);
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
}
