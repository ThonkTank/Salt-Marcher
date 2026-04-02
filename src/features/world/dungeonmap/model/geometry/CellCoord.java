package features.world.dungeonmap.model.geometry;

import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.Set;

/**
 * Canonical cell-space coordinate for dungeon 2D ownership seams.
 */
public record CellCoord(int x, int y) {

    public static final Comparator<CellCoord> ORDER =
            Comparator.comparingInt(CellCoord::y).thenComparingInt(CellCoord::x);
    public static final List<CellCoord> CARDINAL_STEPS = List.of(
            new CellCoord(0, -1),
            new CellCoord(1, 0),
            new CellCoord(0, 1),
            new CellCoord(-1, 0));

    public CellCoord add(CellCoord other) {
        return other == null ? this : new CellCoord(x + other.x, y + other.y);
    }

    public CellCoord subtract(CellCoord other) {
        return other == null ? this : new CellCoord(x - other.x, y - other.y);
    }

    public Set<CellCoord> neighbors4() {
        LinkedHashSet<CellCoord> neighbors = new LinkedHashSet<>();
        for (CellCoord step : CARDINAL_STEPS) {
            neighbors.add(add(step));
        }
        return Set.copyOf(neighbors);
    }

    public boolean isAdjacent4(CellCoord other) {
        return directionTo4(other) != null;
    }

    public CardinalDirection directionTo4(CellCoord other) {
        if (other == null) {
            return null;
        }
        return CardinalDirection.fromDirection(other.subtract(this));
    }

    public int manhattanDistance(CellCoord other) {
        return other == null ? Integer.MAX_VALUE : Math.abs(x - other.x) + Math.abs(y - other.y);
    }

    public long encodedKey() {
        return (((long) x) << 32) ^ (y & 0xffffffffL);
    }

    public Point2i toPoint2i() {
        return new Point2i(x, y);
    }

    public static CellCoord fromPoint(Point2i point) {
        return point == null ? new CellCoord(0, 0) : new CellCoord(point.x(), point.y());
    }

    public static Set<CellCoord> fromPoints(Collection<Point2i> points) {
        LinkedHashSet<CellCoord> result = new LinkedHashSet<>();
        if (points != null) {
            for (Point2i point : points) {
                if (point != null) {
                    result.add(fromPoint(point));
                }
            }
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    public static Set<CellCoord> normalize(Collection<CellCoord> cells) {
        LinkedHashSet<CellCoord> result = new LinkedHashSet<>();
        if (cells != null) {
            cells.stream()
                    .filter(cell -> cell != null)
                    .sorted(ORDER)
                    .forEach(result::add);
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    public static CellCoord bestCenter(Collection<CellCoord> cells) {
        Set<CellCoord> normalizedCells = normalize(cells);
        if (normalizedCells.isEmpty()) {
            return new CellCoord(0, 0);
        }
        double averageX = normalizedCells.stream().mapToInt(CellCoord::x).average().orElse(0.0);
        double averageY = normalizedCells.stream().mapToInt(CellCoord::y).average().orElse(0.0);
        return normalizedCells.stream()
                .min(Comparator
                        .comparingDouble((CellCoord cell) -> squaredDistance(cell, averageX, averageY))
                        .thenComparing(ORDER))
                .orElse(new CellCoord(0, 0));
    }

    public static Point2i bestPoint(Collection<Point2i> points) {
        return bestCenter(fromPoints(points)).toPoint2i();
    }

    public static List<Set<CellCoord>> connectedComponents(Collection<CellCoord> cells) {
        Set<CellCoord> normalizedCells = normalize(cells);
        if (normalizedCells.isEmpty()) {
            return List.of();
        }
        LinkedHashSet<CellCoord> remaining = new LinkedHashSet<>(normalizedCells);
        ArrayList<Set<CellCoord>> result = new ArrayList<>();
        while (!remaining.isEmpty()) {
            CellCoord seed = remaining.iterator().next();
            ArrayDeque<CellCoord> queue = new ArrayDeque<>();
            LinkedHashSet<CellCoord> component = new LinkedHashSet<>();
            queue.add(seed);
            remaining.remove(seed);
            while (!queue.isEmpty()) {
                CellCoord current = queue.removeFirst();
                if (!component.add(current)) {
                    continue;
                }
                for (CellCoord step : CARDINAL_STEPS) {
                    CellCoord neighbor = current.add(step);
                    if (remaining.remove(neighbor)) {
                        queue.addLast(neighbor);
                    }
                }
            }
            result.add(Set.copyOf(component));
        }
        return List.copyOf(result);
    }

    public static Set<CellCoord> componentCenters(Collection<CellCoord> cells) {
        LinkedHashSet<CellCoord> result = connectedComponents(cells).stream()
                .map(CellCoord::bestCenter)
                .sorted(ORDER)
                .collect(LinkedHashSet::new, Set::add, Set::addAll);
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    public static Set<CellCoord> componentCentersOfPoints(Collection<Point2i> points) {
        return componentCenters(fromPoints(points));
    }

    public static Set<Point2i> toPoints(Collection<CellCoord> cells) {
        LinkedHashSet<Point2i> result = new LinkedHashSet<>();
        if (cells != null) {
            for (CellCoord cell : cells) {
                if (cell != null) {
                    result.add(cell.toPoint2i());
                }
            }
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    private static double squaredDistance(CellCoord cell, double centerX, double centerY) {
        double deltaX = cell.x() - centerX;
        double deltaY = cell.y() - centerY;
        return deltaX * deltaX + deltaY * deltaY;
    }
}
