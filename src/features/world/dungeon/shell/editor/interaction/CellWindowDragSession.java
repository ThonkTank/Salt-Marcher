package features.world.dungeon.shell.editor.interaction;

import features.world.dungeon.geometry.GridArea;
import features.world.dungeon.geometry.GridOccupant;
import features.world.dungeon.geometry.GridPoint;

/**
 * Shared rectangular cell-window draft for paint-style editor tools.
 */
public record CellWindowDragSession(
        GridPoint startCell,
        GridPoint endCell,
        boolean deleteMode
) implements GridOccupant {
    @Override
    public GridArea cellFootprint() {
        return GridArea.rectangle(startCell, endCell);
    }

    public CellWindowDragSession withEndCell(GridPoint endCell) {
        return new CellWindowDragSession(startCell, endCell, deleteMode);
    }
}
