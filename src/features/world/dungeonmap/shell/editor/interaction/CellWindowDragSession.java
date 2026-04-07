package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.geometry.GridPoint;

import java.util.LinkedHashSet;
import java.util.Set;

/**
 * Shared rectangular cell-window draft for paint-style editor tools.
 */
public record CellWindowDragSession(
        GridPoint startCell,
        GridPoint endCell,
        boolean deleteMode
) {
    public Set<GridPoint> previewCells() {
        if (startCell == null || endCell == null) {
            return Set.of();
        }
        int minX = Math.min(startCell.cellX(), endCell.cellX());
        int maxX = Math.max(startCell.cellX(), endCell.cellX());
        int minY = Math.min(startCell.cellY(), endCell.cellY());
        int maxY = Math.max(startCell.cellY(), endCell.cellY());
        LinkedHashSet<GridPoint> cells = new LinkedHashSet<>();
        for (int x = minX; x <= maxX; x++) {
            for (int y = minY; y <= maxY; y++) {
                cells.add(GridPoint.cell(x, y, startCell.z()));
            }
        }
        return cells.isEmpty() ? Set.of() : Set.copyOf(cells);
    }

    public CellWindowDragSession withEndCell(GridPoint endCell) {
        return new CellWindowDragSession(startCell, endCell, deleteMode);
    }
}
