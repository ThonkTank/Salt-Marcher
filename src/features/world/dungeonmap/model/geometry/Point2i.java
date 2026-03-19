package features.world.dungeonmap.model.geometry;

import java.util.LinkedHashSet;
import java.util.Set;

public record Point2i(int x, int y) {

    public static Set<Point2i> translateAll(Set<Point2i> cells, Point2i delta) {
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

    public Point2i subtract(Point2i other) {
        return other == null ? this : new Point2i(x - other.x, y - other.y);
    }

    public int distanceTo(Point2i other) {
        return other == null ? Integer.MAX_VALUE : Math.abs(x - other.x) + Math.abs(y - other.y);
    }
}
