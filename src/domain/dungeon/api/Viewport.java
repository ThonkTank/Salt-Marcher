package src.domain.dungeon.api;

/**
 * View-local viewport copied into map snapshot queries.
 */
public record Viewport(
        double centerX,
        double centerY,
        double canvasWidth,
        double canvasHeight,
        double zoom
) {

    public Viewport {
        canvasWidth = Math.max(1.0, canvasWidth);
        canvasHeight = Math.max(1.0, canvasHeight);
        zoom = Math.max(0.1, zoom);
    }

    public static Viewport defaultViewport() {
        return new Viewport(0.0, 0.0, 960.0, 640.0, 1.0);
    }
}
