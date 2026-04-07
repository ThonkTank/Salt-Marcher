package features.world.dungeonmap.geometry;

public record GridTranslation(
        int dxCells,
        int dyCells,
        int dzLevels
) {

    public static GridTranslation none() {
        return new GridTranslation(0, 0, 0);
    }

    public boolean isZero() {
        return dxCells == 0 && dyCells == 0 && dzLevels == 0;
    }
}
