package features.world.dungeonmap.model.geometry;

import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
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
}
