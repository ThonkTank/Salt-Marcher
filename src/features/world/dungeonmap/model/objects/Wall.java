package features.world.dungeonmap.model.objects;

import features.world.dungeonmap.model.geometry.Point2i;

public record Wall(
        Point2i roomCell,
        Point2i delta,
        TileShape shape
) {
    public Wall {
        roomCell = roomCell == null ? new Point2i(0, 0) : roomCell;
        delta = delta == null ? new Point2i(0, 0) : delta;
        shape = shape == null ? TileShape.singleCell(roomCell) : shape;
    }
}
