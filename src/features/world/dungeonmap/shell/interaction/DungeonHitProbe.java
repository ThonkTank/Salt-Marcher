package features.world.dungeonmap.shell.interaction;

import features.world.dungeonmap.model.geometry.Point2i;
import javafx.geometry.Point2D;

import java.util.Objects;

public record DungeonHitProbe(
        Point2D canvasPoint,
        Point2i gridCell,
        int levelZ,
        double panX,
        double panY,
        double gridSizePx
) {

    public DungeonHitProbe {
        canvasPoint = Objects.requireNonNull(canvasPoint, "canvasPoint");
        gridCell = Objects.requireNonNull(gridCell, "gridCell");
        requireFinite(panX, "panX");
        requireFinite(panY, "panY");
        requireFinite(gridSizePx, "gridSizePx");
        if (gridSizePx <= 0.0) {
            throw new IllegalArgumentException("gridSizePx must be > 0");
        }
    }

    public Point2D canvasPointForGrid(Point2i point) {
        Point2i resolvedPoint = Objects.requireNonNull(point, "point");
        return new Point2D(
                panX + resolvedPoint.x() * gridSizePx,
                panY + resolvedPoint.y() * gridSizePx);
    }

    public Point2D canvasPointForDoubled(Point2i doubledPoint) {
        Point2i resolvedPoint = Objects.requireNonNull(doubledPoint, "doubledPoint");
        return new Point2D(
                panX + resolvedPoint.x() * gridSizePx / 2.0,
                panY + resolvedPoint.y() * gridSizePx / 2.0);
    }

    private static void requireFinite(double value, String name) {
        if (!Double.isFinite(value)) {
            throw new IllegalArgumentException(name + " must be finite");
        }
    }
}
