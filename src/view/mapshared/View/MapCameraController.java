package src.view.mapshared.View;

import src.view.mapshared.Model.MapViewport;

/**
 * View-local camera state owner for the shared map workspace.
 */
public final class MapCameraController {

    public static final double BASE_TILE_PIXELS = 32.0;

    private static final double MIN_ZOOM = 0.1;
    private static final double MAX_ZOOM = 4.0;

    private double centerX;
    private double centerY;
    private double zoom = 1.0;

    public double zoom() {
        return zoom;
    }

    public void panByTiles(double deltaX, double deltaY) {
        centerX += deltaX;
        centerY += deltaY;
    }

    public void zoomAround(double canvasX, double canvasY, double canvasWidth, double canvasHeight, double factor) {
        double oldScale = pixelsPerTile();
        double worldX = centerX + (canvasX - canvasWidth / 2.0) / oldScale;
        double worldY = centerY + (canvasY - canvasHeight / 2.0) / oldScale;
        zoom = clampZoom(zoom * factor);
        double newScale = pixelsPerTile();
        centerX = worldX - (canvasX - canvasWidth / 2.0) / newScale;
        centerY = worldY - (canvasY - canvasHeight / 2.0) / newScale;
    }

    public MapViewport currentViewport(double canvasWidth, double canvasHeight) {
        return new MapViewport(centerX, centerY, canvasWidth, canvasHeight, zoom);
    }

    public double pixelsPerTile() {
        return BASE_TILE_PIXELS * zoom;
    }

    public void reset() {
        centerX = 0.0;
        centerY = 0.0;
        zoom = 1.0;
    }

    private double clampZoom(double value) {
        return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value));
    }
}
