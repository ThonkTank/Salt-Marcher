package features.world.dungeonmap.canvas.grid;

import features.world.dungeonmap.canvas.base.DungeonCanvasCamera;
import features.world.dungeonmap.model.geometry.GridAnchor;
import features.world.dungeonmap.model.geometry.Point2i;
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
        Point2D anchor = anchorPoint(handle, camera, gridSize);
        double width = labelWidth(handle.label());
        return new Rectangle2D(anchor.getX() - width / 2.0, anchor.getY() - HEIGHT / 2.0, width, HEIGHT);
    }

    public static Point2D anchorPoint(InteractiveLabelHandle handle, DungeonCanvasCamera camera, double gridSize) {
        GridAnchor anchor = handle == null ? null : handle.anchor();
        Point2i doubled = anchor == null ? new Point2i(1, 1) : anchor.doubledGridPoint();
        return new Point2D(
                camera.panX() + (doubled.x() / 2.0) * gridSize,
                camera.panY() + (doubled.y() / 2.0) * gridSize);
    }

    public static double labelWidth(String label) {
        return Math.max(56.0, label == null ? 56.0 : label.length() * CHARACTER_WIDTH + HORIZONTAL_PADDING);
    }
}
