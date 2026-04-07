package features.world.dungeon.geometry;

public record GridTranslation(
        int dxCells,
        int dyCells,
        int dzLevels
) {

    public static GridTranslation cells(int dxCells, int dyCells, int dzLevels) {
        return new GridTranslation(dxCells, dyCells, dzLevels);
    }

    public static GridTranslation none() {
        return new GridTranslation(0, 0, 0);
    }

    public static GridTranslation betweenCells(GridPoint startCell, GridPoint endCell) {
        if (startCell == null || endCell == null) {
            return none();
        }
        return new GridTranslation(
                endCell.cellX() - startCell.cellX(),
                endCell.cellY() - startCell.cellY(),
                endCell.z() - startCell.z());
    }

    public boolean isZero() {
        return dxCells == 0 && dyCells == 0 && dzLevels == 0;
    }
}
