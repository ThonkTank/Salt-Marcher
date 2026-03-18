package features.world.dungeonmap.foundation.geometry;
import features.world.dungeonmap.foundation.geometry.Point2i;


public record Point2i(int x, int y) {
    public Point2i add(Point2i other) {
        return new Point2i(x + other.x, y + other.y);
    }

    public Point2i subtract(Point2i other) {
        return new Point2i(x - other.x, y - other.y);
    }

    public int distanceTo(Point2i other) {
        return Math.abs(x - other.x) + Math.abs(y - other.y);
    }
}
