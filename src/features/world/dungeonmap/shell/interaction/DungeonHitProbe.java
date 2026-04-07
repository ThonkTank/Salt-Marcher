package features.world.dungeonmap.shell.interaction;

import features.world.dungeonmap.geometry.GridPoint;
import features.world.dungeonmap.geometry.GridPoint;
import javafx.geometry.Point2D;

import java.util.Objects;

/**
 * Hit probing carries both a tile cell and the canonical 2x probe point.
 *
 * <p>`gridCell` stays a convenience cell query for tile-owned logic; geometry-backed seams must use `probePoint2x`.
 */
public record DungeonHitProbe(
        Point2D canvasPoint,
        GridPoint gridCell,
        GridPoint probePoint2x,
        int levelZ,
        double panX,
        double panY,
        double gridSizePx
) {

    public DungeonHitProbe {
        canvasPoint = Objects.requireNonNull(canvasPoint, "canvasPoint");
        gridCell = Objects.requireNonNull(gridCell, "gridCell");
        probePoint2x = Objects.requireNonNull(probePoint2x, "probePoint2x");
        requireFinite(panX, "panX");
        requireFinite(panY, "panY");
        requireFinite(gridSizePx, "gridSizePx");
        if (gridSizePx <= 0.0) {
            throw new IllegalArgumentException("gridSizePx must be > 0");
        }
    }

    public static GridPoint point2xForCanvas(Point2D canvasPoint, double panX, double panY, double gridSizePx) {
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
        return GridPoint.raw(
                (int) Math.round((resolvedPoint.getX() - panX) / halfGrid) - 1,
                (int) Math.round((resolvedPoint.getY() - panY) / halfGrid) - 1);
    }

    public Point2D canvasPointForGrid(GridPoint cell) {
        GridPoint resolvedCell = Objects.requireNonNull(cell, "cell");
        return new Point2D(
                panX + resolvedCell.x() * gridSizePx,
                panY + resolvedCell.y() * gridSizePx);
    }

    public Point2D canvasPointForPoint2x(GridPoint point2x) {
        GridPoint resolvedPoint = Objects.requireNonNull(point2x, "point2x");
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
