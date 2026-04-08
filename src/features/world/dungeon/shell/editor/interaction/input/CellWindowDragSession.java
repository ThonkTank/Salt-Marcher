package features.world.dungeon.shell.editor.interaction.input;

/**
 * Shared rectangular cell-window draft for paint-style editor tools.
 */
public record CellWindowDragSession(
        features.world.dungeon.geometry.GridPoint startCell,
        features.world.dungeon.geometry.GridPoint endCell,
        boolean deleteMode
) implements features.world.dungeon.geometry.GridOccupant {
    @Override
    public features.world.dungeon.geometry.GridArea cellFootprint() {
        return features.world.dungeon.geometry.GridArea.rectangle(startCell, endCell);
    }

    public CellWindowDragSession withEndCell(features.world.dungeon.geometry.GridPoint endCell) {
        return new CellWindowDragSession(startCell, endCell, deleteMode);
    }
}
