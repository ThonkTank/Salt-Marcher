package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.TileShape;
import features.world.dungeonmap.model.objects.StructureDescriptor;
import features.world.dungeonmap.model.objects.StructureObject;

import java.util.Map;

public record RoomPaintSession(
        Point2i startCell,
        Point2i endCell,
        boolean deleteMode
) {
    public TileShape previewShape() {
        return TileShape.rectangle(startCell, endCell);
    }

    public StructureDescriptor previewDescriptor(int levelZ) {
        return StructureDescriptor.fromCellsByLevel(Map.of(levelZ, previewShape().absoluteCells()));
    }

    public StructureObject previewStructure(int levelZ) {
        return StructureObject.fromDescriptor(previewDescriptor(levelZ));
    }

    public RoomPaintSession withEndCell(Point2i endCell) {
        return new RoomPaintSession(startCell, endCell, deleteMode);
    }
}
