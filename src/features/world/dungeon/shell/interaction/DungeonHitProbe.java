package features.world.dungeon.shell.interaction;

import features.world.dungeon.geometry.GridPoint;
import javafx.geometry.Point2D;

import java.util.Objects;

/**
 * Hit probing carries both a tile cell and the canonical 2x probe point.
 *
 * <p>`gridCell` stays a convenience cell query for tile-owned logic; geometry-backed seams must use `probePoint`.
 */
public record DungeonHitProbe(
        Point2D canvasPoint,
        GridPoint gridCell,
        GridPoint probePoint,
        int levelZ,
        double panX,
        double panY,
        double gridSizePx
) {

    public DungeonHitProbe {
        canvasPoint = Objects.requireNonNull(canvasPoint, "canvasPoint");
        gridCell = Objects.requireNonNull(gridCell, "gridCell");
        probePoint = Objects.requireNonNull(probePoint, "probePoint");
        requireFinite(panX, "panX");
        requireFinite(panY, "panY");
        requireFinite(gridSizePx, "gridSizePx");
        if (gridSizePx <= 0.0) {
            throw new IllegalArgumentException("gridSizePx must be > 0");
        }
    }

    public static GridPoint gridPointForCanvas(Point2D canvasPoint, double panX, double panY, double gridSizePx) {
        Point2D resolvedPoint = Objects.requireNonNull(canvasPoint, "canvasPoint");
        requireFinite(panX, "panX");
        requireFinite(panY, "panY");
        requireFinite(gridSizePx, "gridSizePx");
        if (gridSizePx <= 0.0) {
            throw new IllegalArgumentException("gridSizePx must be > 0");
        }
        double halfGrid = gridSizePx / 2.0;
        // Pixel projection treats the top-left corner of GridPoint(0,0) as GridPoint(-1,-1), so raw 2x values map
        // to canvas space with a fixed half-cell offset rather than a storage compatibility codec.
        return GridPoint.lattice(
                (int) Math.round((resolvedPoint.getX() - panX) / halfGrid) - 1,
                (int) Math.round((resolvedPoint.getY() - panY) / halfGrid) - 1,
                0);
    }

    public Point2D canvasPointForGrid(GridPoint cell) {
        GridPoint resolvedCell = Objects.requireNonNull(cell, "cell");
        return new Point2D(
                panX + (resolvedCell.x2() / 2.0) * gridSizePx,
                panY + (resolvedCell.y2() / 2.0) * gridSizePx);
    }

    public Point2D canvasPointForGridPoint(GridPoint point) {
        GridPoint resolvedPoint = Objects.requireNonNull(point, "point");
        return new Point2D(
                panX + (resolvedPoint.x2() + 1) * gridSizePx / 2.0,
                panY + (resolvedPoint.y2() + 1) * gridSizePx / 2.0);
    }

    private static void requireFinite(double value, String name) {
        if (!Double.isFinite(value)) {
            throw new IllegalArgumentException(name + " must be finite");
        }
    }
}
