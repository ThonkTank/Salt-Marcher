package src.view.slotcontent.main.dungeonmap;

import javafx.beans.property.ReadOnlyDoubleProperty;
import javafx.beans.property.ReadOnlyDoubleWrapper;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.Viewport;

final class DungeonMapViewportContentPartModel {
    private static final double BASE_GRID = 32.0;
    private static final double DEFAULT_ZOOM = 1.0;
    private static final double MINIMUM_ZOOM = 0.1;
    private static final double MAXIMUM_ZOOM = 4.0;

    private Viewport viewport = Viewport.initial();
    private final ReadOnlyDoubleWrapper zoom = new ReadOnlyDoubleWrapper(viewport.zoom());

    ReadOnlyDoubleProperty zoomProperty() {
        return zoom.getReadOnlyProperty();
    }

    Viewport currentViewport() {
        return viewport;
    }

    double currentZoom() {
        return viewport.zoom();
    }

    Viewport resetCamera() {
        return setViewport(Viewport.initial());
    }

    Viewport panByPixels(double deltaX, double deltaY) {
        return setViewport(new Viewport(
                viewport.panX() + deltaX,
                viewport.panY() + deltaY,
                viewport.zoom()));
    }

    Viewport zoomAround(double canvasX, double canvasY, double factor) {
        double nextZoom = clampZoom(viewport.zoom() * factor);
        double scale = nextZoom / viewport.zoom();
        return setViewport(new Viewport(
                canvasX - (canvasX - viewport.panX()) * scale,
                canvasY - (canvasY - viewport.panY()) * scale,
                nextZoom));
    }

    static double baseGrid() {
        return BASE_GRID;
    }

    static double defaultZoom() {
        return DEFAULT_ZOOM;
    }

    static double minimumZoom() {
        return MINIMUM_ZOOM;
    }

    static double maximumZoom() {
        return MAXIMUM_ZOOM;
    }

    private Viewport setViewport(Viewport nextViewport) {
        viewport = nextViewport == null ? Viewport.initial() : nextViewport;
        zoom.set(viewport.zoom());
        return viewport;
    }

    private static double clampZoom(double value) {
        return Math.max(minimumZoom(), Math.min(maximumZoom(), value));
    }
}
