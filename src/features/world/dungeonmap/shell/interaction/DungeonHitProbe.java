package features.world.dungeonmap.shell.interaction;

import features.world.dungeonmap.model.geometry.GridPoint2x;
import features.world.dungeonmap.model.geometry.Point2i;
import javafx.geometry.Point2D;

import java.util.Objects;

public record DungeonHitProbe(
        Point2D canvasPoint,
        Point2i gridCell,
        GridPoint2x probePoint2x,
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

    public static GridPoint2x point2xForCanvas(Point2D canvasPoint, double panX, double panY, double gridSizePx) {
        Point2D resolvedPoint = Objects.requireNonNull(canvasPoint, "canvasPoint");
        requireFinite(panX, "panX");
        requireFinite(panY, "panY");
        requireFinite(gridSizePx, "gridSizePx");
        if (gridSizePx <= 0.0) {
            throw new IllegalArgumentException("gridSizePx must be > 0");
        }
        double halfGrid = gridSizePx / 2.0;
        return GridPoint2x.fromRaw(
                (int) Math.round((resolvedPoint.getX() - panX) / halfGrid),
                (int) Math.round((resolvedPoint.getY() - panY) / halfGrid));
    }

    public Point2D canvasPointForGrid(Point2i point) {
        Point2i resolvedPoint = Objects.requireNonNull(point, "point");
        return new Point2D(
                panX + resolvedPoint.x() * gridSizePx,
                panY + resolvedPoint.y() * gridSizePx);
    }

    public Point2D canvasPointForPoint2x(GridPoint2x point2x) {
        GridPoint2x resolvedPoint = Objects.requireNonNull(point2x, "point2x");
        return new Point2D(
                panX + resolvedPoint.x2() * gridSizePx / 2.0,
                panY + resolvedPoint.y2() * gridSizePx / 2.0);
    }

    private static void requireFinite(double value, String name) {
        if (!Double.isFinite(value)) {
            throw new IllegalArgumentException(name + " must be finite");
        }
    }
}
