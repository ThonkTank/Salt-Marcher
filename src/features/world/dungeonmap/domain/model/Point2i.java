package features.world.dungeonmap.domain.model;

public record Point2i(int x, int y) {
    public Point2i add(Point2i other) {
        return new Point2i(x + other.x, y + other.y);
    }

    public Point2i subtract(Point2i other) {
        return new Point2i(x - other.x, y - other.y);
    }
}
