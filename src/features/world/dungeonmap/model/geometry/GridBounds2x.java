package features.world.dungeonmap.model.geometry;

/**
 * Inclusive bounds on the doubled dungeon grid.
 */
public record GridBounds2x(int minX2, int minY2, int maxX2, int maxY2) {

    private static final GridBounds2x EMPTY = new GridBounds2x(0, 0, -1, -1);

    public static GridBounds2x empty() {
        return EMPTY;
    }

    public boolean isEmpty() {
        return maxX2 < minX2 || maxY2 < minY2;
    }

    public int width2() {
        return isEmpty() ? 0 : maxX2 - minX2;
    }

    public int height2() {
        return isEmpty() ? 0 : maxY2 - minY2;
    }

    public GridBounds2x translatedByCells(Point2i delta) {
        return translatedByCells(CellCoord.fromPoint(delta));
    }

    public GridBounds2x translatedByCells(CellCoord delta) {
        if (isEmpty()) {
            return this;
        }
        CellCoord resolvedDelta = delta == null ? new CellCoord(0, 0) : delta;
        if (resolvedDelta.x() == 0 && resolvedDelta.y() == 0) {
            return this;
        }
        int xOffset = resolvedDelta.x() * 2;
        int yOffset = resolvedDelta.y() * 2;
        return new GridBounds2x(minX2 + xOffset, minY2 + yOffset, maxX2 + xOffset, maxY2 + yOffset);
    }

    public GridBounds2x union(GridBounds2x other) {
        if (other == null || other.isEmpty()) {
            return this;
        }
        if (isEmpty()) {
            return other;
        }
        return new GridBounds2x(
                Math.min(minX2, other.minX2),
                Math.min(minY2, other.minY2),
                Math.max(maxX2, other.maxX2),
                Math.max(maxY2, other.maxY2));
    }
}
