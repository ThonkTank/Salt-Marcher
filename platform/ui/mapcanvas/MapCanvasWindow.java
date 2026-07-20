package platform.ui.mapcanvas;

/** Visible scene-unit window, independent of an adopter coordinate system. */
public record MapCanvasWindow(double minX, double minY, double maxX, double maxY) {
    public MapCanvasWindow {
        if (!Double.isFinite(minX) || !Double.isFinite(minY)
                || !Double.isFinite(maxX) || !Double.isFinite(maxY)
                || maxX < minX || maxY < minY) {
            throw new IllegalArgumentException("map canvas window must be finite and ordered");
        }
    }

    public static MapCanvasWindow visible(
            MapCanvasViewport viewport,
            double screenWidth,
            double screenHeight,
            double scenePadding
    ) {
        MapCanvasViewport safeViewport = viewport == null
                ? new MapCanvasViewport(0.0, 0.0, 1.0, 1.0)
                : viewport;
        double width = finiteNonNegative(screenWidth);
        double height = finiteNonNegative(screenHeight);
        double padding = finiteNonNegative(scenePadding);
        return new MapCanvasWindow(
                safeViewport.screenToSceneX(0.0) - padding,
                safeViewport.screenToSceneY(0.0) - padding,
                safeViewport.screenToSceneX(width) + padding,
                safeViewport.screenToSceneY(height) + padding);
    }

    public boolean intersects(double otherMinX, double otherMinY, double otherMaxX, double otherMaxY) {
        if (!Double.isFinite(otherMinX) || !Double.isFinite(otherMinY)
                || !Double.isFinite(otherMaxX) || !Double.isFinite(otherMaxY)
                || otherMaxX < otherMinX || otherMaxY < otherMinY) {
            return false;
        }
        return otherMaxX >= minX && otherMinX <= maxX
                && otherMaxY >= minY && otherMinY <= maxY;
    }

    private static double finiteNonNegative(double value) {
        return Double.isFinite(value) ? Math.max(0.0, value) : 0.0;
    }
}
