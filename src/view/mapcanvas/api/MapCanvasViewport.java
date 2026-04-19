package src.view.mapcanvas.api;

/**
 * View-local camera viewport for the shared dungeon map canvas.
 */
public record MapCanvasViewport(
        double centerX,
        double centerY,
        double canvasWidth,
        double canvasHeight,
        double zoom
) {

    private static final double BASE_TILE_PIXELS = 32.0;

    public MapCanvasViewport {
        canvasWidth = Math.max(1.0, canvasWidth);
        canvasHeight = Math.max(1.0, canvasHeight);
        zoom = Math.max(0.1, zoom);
    }

    public static MapCanvasViewport defaultViewport() {
        return new MapCanvasViewport(0.0, 0.0, 960.0, 640.0, 1.0);
    }

    public double tilePixels() {
        return BASE_TILE_PIXELS * zoom;
    }

    public double worldToScreenX(double worldX) {
        return canvasWidth / 2.0 + (worldX - centerX) * tilePixels();
    }

    public double worldToScreenY(double worldY) {
        return canvasHeight / 2.0 + (worldY - centerY) * tilePixels();
    }

    public double cellCenterScreenX(int column) {
        return worldToScreenX(column + 0.5);
    }

    public double cellCenterScreenY(int row) {
        return worldToScreenY(row + 0.5);
    }
}
