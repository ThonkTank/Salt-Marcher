package features.world.dungeonmap.canvas.grid;

import features.world.dungeonmap.canvas.base.DungeonCanvasCamera;
import features.world.dungeonmap.model.geometry.GridPoint2x;
import features.world.dungeonmap.model.interaction.InteractiveLabelHandle;
import javafx.geometry.Point2D;
import javafx.geometry.Rectangle2D;

public final class DungeonGridInteractiveLabels {

    private static final double HEIGHT = 24.0;
    private static final double HORIZONTAL_PADDING = 16.0;
    private static final double CHARACTER_WIDTH = 7.2;

    private DungeonGridInteractiveLabels() {
    }

    public static Rectangle2D bounds(InteractiveLabelHandle handle, DungeonCanvasCamera camera, double gridSize) {
        if (handle == null || camera == null || gridSize <= 0.0) {
            return Rectangle2D.EMPTY;
        }
        Point2D anchor = anchorPoint(handle, camera.panX(), camera.panY(), gridSize);
        double width = labelWidth(handle.label());
        return new Rectangle2D(anchor.getX() - width / 2.0, anchor.getY() - HEIGHT / 2.0, width, HEIGHT);
    }

    public static Point2D anchorPoint(InteractiveLabelHandle handle, DungeonCanvasCamera camera, double gridSize) {
        if (handle == null || camera == null) {
            return new Point2D(0.0, 0.0);
        }
        return anchorPoint(handle, camera.panX(), camera.panY(), gridSize);
    }

    public static Rectangle2D bounds(InteractiveLabelHandle handle, double panX, double panY, double gridSize) {
        if (handle == null || gridSize <= 0.0) {
            return Rectangle2D.EMPTY;
        }
        Point2D anchor = anchorPoint(handle, panX, panY, gridSize);
        double width = labelWidth(handle.label());
        return new Rectangle2D(anchor.getX() - width / 2.0, anchor.getY() - HEIGHT / 2.0, width, HEIGHT);
    }

    public static Point2D anchorPoint(InteractiveLabelHandle handle, double panX, double panY, double gridSize) {
        if (handle == null || gridSize <= 0.0) {
            return new Point2D(0.0, 0.0);
        }
        GridPoint2x anchor = handle.anchor2x();
        return new Point2D(
                panX + (anchor.x2() + 1) * gridSize / 2.0,
                panY + (anchor.y2() + 1) * gridSize / 2.0);
    }

    public static double labelWidth(String label) {
        return Math.max(56.0, label == null ? 56.0 : label.length() * CHARACTER_WIDTH + HORIZONTAL_PADDING);
    }
}
