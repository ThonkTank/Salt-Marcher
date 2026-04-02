package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.objects.StructureDescriptor;
import features.world.dungeonmap.model.objects.StructureObject;

import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;

public record RoomPaintSession(
        CellCoord startCell,
        CellCoord endCell,
        boolean deleteMode
) {
    public Set<CellCoord> previewCells() {
        if (startCell == null || endCell == null) {
            return Set.of();
        }
        int minX = Math.min(startCell.x(), endCell.x());
        int maxX = Math.max(startCell.x(), endCell.x());
        int minY = Math.min(startCell.y(), endCell.y());
        int maxY = Math.max(startCell.y(), endCell.y());
        LinkedHashSet<CellCoord> cells = new LinkedHashSet<>();
        for (int x = minX; x <= maxX; x++) {
            for (int y = minY; y <= maxY; y++) {
                cells.add(new CellCoord(x, y));
            }
        }
        return cells.isEmpty() ? Set.of() : Set.copyOf(cells);
    }

    public StructureDescriptor previewDescriptor(int levelZ) {
        Set<CellCoord> cells = previewCells();
        return cells.isEmpty()
                ? StructureDescriptor.empty()
                : StructureDescriptor.fromCellCoordsByLevel(Map.of(levelZ, cells));
    }

    public StructureObject previewStructure(int levelZ) {
        return StructureObject.fromDescriptor(previewDescriptor(levelZ));
    }

    public RoomPaintSession withEndCell(CellCoord endCell) {
        return new RoomPaintSession(startCell, endCell, deleteMode);
    }
}
