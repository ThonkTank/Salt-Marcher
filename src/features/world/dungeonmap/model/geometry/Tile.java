package features.world.dungeonmap.model.geometry;

public record Tile(Point2i position) {
    public Tile {
        position = position == null ? new Point2i(0, 0) : position;
    }
}
