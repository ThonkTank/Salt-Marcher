package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.TileShape;

public record RoomPaintSession(
        Point2i startCell,
        Point2i endCell,
        boolean deleteMode
) {
    public TileShape previewShape() {
        return TileShape.rectangle(startCell, endCell);
    }

    public RoomPaintSession withEndCell(Point2i endCell) {
        return new RoomPaintSession(startCell, endCell, deleteMode);
    }
}
