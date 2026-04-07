package features.world.dungeon.shell.editor.interaction;

import features.world.dungeon.geometry.GridPoint;

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
        int minX = Math.min(startCell.x2() / 2, endCell.x2() / 2);
        int maxX = Math.max(startCell.x2() / 2, endCell.x2() / 2);
        int minY = Math.min(startCell.y2() / 2, endCell.y2() / 2);
        int maxY = Math.max(startCell.y2() / 2, endCell.y2() / 2);
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
