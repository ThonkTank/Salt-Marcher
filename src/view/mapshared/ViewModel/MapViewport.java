package src.view.mapshared.ViewModel;

/**
 * View-local camera viewport for the shared dungeon map canvas.
 */
public record MapViewport(
        double centerX,
        double centerY,
        double canvasWidth,
        double canvasHeight,
        double zoom
) {

    public MapViewport {
        canvasWidth = Math.max(1.0, canvasWidth);
        canvasHeight = Math.max(1.0, canvasHeight);
        zoom = Math.max(0.1, zoom);
    }

    public static MapViewport defaultViewport() {
        return new MapViewport(0.0, 0.0, 960.0, 640.0, 1.0);
    }
}
