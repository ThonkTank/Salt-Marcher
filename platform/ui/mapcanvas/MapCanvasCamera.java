package platform.ui.mapcanvas;

/** Passive pan/zoom owner reusable by square and hex map adapters. */
public final class MapCanvasCamera {
    private final double sceneUnitPixels;
    private final double defaultZoom;
    private final double minimumZoom;
    private final double maximumZoom;
    private MapCanvasViewport viewport;

    public MapCanvasCamera(double sceneUnitPixels, double defaultZoom, double minimumZoom, double maximumZoom) {
        if (!Double.isFinite(sceneUnitPixels) || sceneUnitPixels <= 0.0) {
            throw new IllegalArgumentException("sceneUnitPixels must be positive and finite");
        }
        if (!Double.isFinite(minimumZoom) || minimumZoom <= 0.0
                || !Double.isFinite(maximumZoom) || maximumZoom < minimumZoom) {
            throw new IllegalArgumentException("zoom range must be positive and ordered");
        }
        this.sceneUnitPixels = sceneUnitPixels;
        this.minimumZoom = minimumZoom;
        this.maximumZoom = maximumZoom;
        this.defaultZoom = clamp(defaultZoom);
        viewport = new MapCanvasViewport(0.0, 0.0, this.defaultZoom, sceneUnitPixels);
    }

    public MapCanvasViewport viewport() {
        return viewport;
    }

    public MapCanvasViewport reset() {
        viewport = new MapCanvasViewport(0.0, 0.0, defaultZoom, sceneUnitPixels);
        return viewport;
    }

    public MapCanvasViewport panByPixels(double deltaX, double deltaY) {
        viewport = new MapCanvasViewport(
                viewport.panX() + finiteOrZero(deltaX),
                viewport.panY() + finiteOrZero(deltaY),
                viewport.zoom(),
                sceneUnitPixels);
        return viewport;
    }

    public MapCanvasViewport zoomAround(double screenX, double screenY, double factor) {
        double nextZoom = clamp(viewport.zoom() * positiveFactor(factor));
        double scale = nextZoom / viewport.zoom();
        viewport = new MapCanvasViewport(
                finiteOrZero(screenX) - (finiteOrZero(screenX) - viewport.panX()) * scale,
                finiteOrZero(screenY) - (finiteOrZero(screenY) - viewport.panY()) * scale,
                nextZoom,
                sceneUnitPixels);
        return viewport;
    }

    private double clamp(double value) {
        double finite = Double.isFinite(value) ? value : defaultZoomFallback();
        return Math.max(minimumZoom, Math.min(maximumZoom, finite));
    }

    private double defaultZoomFallback() {
        return minimumZoom;
    }

    private static double positiveFactor(double value) {
        return Double.isFinite(value) && value > 0.0 ? value : 1.0;
    }

    private static double finiteOrZero(double value) {
        return Double.isFinite(value) ? value : 0.0;
    }
}
