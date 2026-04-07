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
        int minX = Math.min(startCell.x(), endCell.x());
        int maxX = Math.max(startCell.x(), endCell.x());
        int minY = Math.min(startCell.y(), endCell.y());
        int maxY = Math.max(startCell.y(), endCell.y());
        LinkedHashSet<GridPoint> cells = new LinkedHashSet<>();
        for (int x = minX; x <= maxX; x++) {
            for (int y = minY; y <= maxY; y++) {
                cells.add(new GridPoint(x, y));
            }
        }
        return cells.isEmpty() ? Set.of() : Set.copyOf(cells);
    }

    public CellWindowDragSession withEndCell(GridPoint endCell) {
        return new CellWindowDragSession(startCell, endCell, deleteMode);
    }
}
