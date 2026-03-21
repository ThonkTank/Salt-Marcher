package features.world.dungeonmap.model.geometry;

import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

public record Point2i(int x, int y) {

    // Foundation point/vector type for the whole grid model: arithmetic, ordering, identity, and cardinal adjacency.
    public static final Comparator<Point2i> POINT_ORDER =
            Comparator.comparingInt(Point2i::y).thenComparingInt(Point2i::x);
    public static final List<Point2i> CARDINAL_STEPS = List.of(
            new Point2i(0, -1),
            new Point2i(1, 0),
            new Point2i(0, 1),
            new Point2i(-1, 0));

    public static Set<Point2i> translateAll(Collection<Point2i> cells, Point2i delta) {
        Set<Point2i> translated = new LinkedHashSet<>();
        if (cells == null || delta == null) {
            return translated;
        }
        for (Point2i cell : cells) {
            if (cell != null) {
                translated.add(cell.add(delta));
            }
        }
        return Set.copyOf(translated);
    }

    public Point2i add(Point2i other) {
        return other == null ? this : new Point2i(x + other.x, y + other.y);
    }

    public Point2i translate(int deltaX, int deltaY) {
        return new Point2i(x + deltaX, y + deltaY);
    }

    public Point2i subtract(Point2i other) {
        return other == null ? this : new Point2i(x - other.x, y - other.y);
    }

    public Set<Point2i> neighbors4() {
        Set<Point2i> neighbors = new LinkedHashSet<>();
        for (Point2i step : CARDINAL_STEPS) {
            neighbors.add(add(step));
        }
        return Set.copyOf(neighbors);
    }

    public boolean isAdjacent4(Point2i other) {
        return directionToCardinal(other) != null;
    }

    public Point2i directionToCardinal(Point2i other) {
        if (other == null) {
            return null;
        }
        Point2i delta = other.subtract(this);
        for (Point2i step : CARDINAL_STEPS) {
            if (step.equals(delta)) {
                return step;
            }
        }
        return null;
    }

    public int distanceTo(Point2i other) {
        return other == null ? Integer.MAX_VALUE : Math.abs(x - other.x) + Math.abs(y - other.y);
    }

    public long encodedKey() {
        return (((long) x) << 32) ^ (y & 0xffffffffL);
    }

    public static long encode(Point2i point) {
        return point == null ? new Point2i(0, 0).encodedKey() : point.encodedKey();
    }
}
