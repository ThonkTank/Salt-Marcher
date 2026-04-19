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

    public MapCanvasViewport {
        canvasWidth = Math.max(1.0, canvasWidth);
        canvasHeight = Math.max(1.0, canvasHeight);
        zoom = Math.max(0.1, zoom);
    }

    public static MapCanvasViewport defaultViewport() {
        return new MapCanvasViewport(0.0, 0.0, 960.0, 640.0, 1.0);
    }
}
