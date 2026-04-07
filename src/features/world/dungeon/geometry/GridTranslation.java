package features.world.dungeon.geometry;

public record GridTranslation(
        int dxCells,
        int dyCells,
        int dzLevels
) {

    public static GridTranslation cells(int dxCells, int dyCells, int dzLevels) {
        return new GridTranslation(dxCells, dyCells, dzLevels);
    }

    public static GridTranslation planar(int dxCells, int dyCells) {
        return new GridTranslation(dxCells, dyCells, 0);
    }

    public static GridTranslation levels(int dzLevels) {
        return new GridTranslation(0, 0, dzLevels);
    }

    public static GridTranslation none() {
        return new GridTranslation(0, 0, 0);
    }

    public static GridTranslation betweenCells(GridPoint startCell, GridPoint endCell) {
        if (startCell == null || endCell == null) {
            return none();
        }
        requireCell(startCell, "startCell");
        requireCell(endCell, "endCell");
        return new GridTranslation(
                (endCell.x2() - startCell.x2()) / 2,
                (endCell.y2() - startCell.y2()) / 2,
                endCell.z() - startCell.z());
    }

    public GridTranslation combinedWith(GridTranslation other) {
        GridTranslation resolvedOther = other == null ? none() : other;
        return new GridTranslation(
                dxCells + resolvedOther.dxCells(),
                dyCells + resolvedOther.dyCells(),
                dzLevels + resolvedOther.dzLevels());
    }

    public boolean isZero() {
        return dxCells == 0 && dyCells == 0 && dzLevels == 0;
    }

    private static void requireCell(GridPoint point, String name) {
        if (point.kind() != GridPoint.Kind.CELL) {
            throw new IllegalArgumentException(name + " must be a cell");
        }
    }
}
