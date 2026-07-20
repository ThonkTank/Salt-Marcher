package features.dungeon.adapter.javafx.map;

import javafx.beans.property.ReadOnlyDoubleProperty;
import javafx.beans.property.ReadOnlyDoubleWrapper;
import features.dungeon.adapter.javafx.map.DungeonMapContentModel.Viewport;
import platform.ui.mapcanvas.MapCanvasCamera;
import platform.ui.mapcanvas.MapCanvasViewport;

final class DungeonMapViewportState {
    private final MapCanvasCamera camera = new MapCanvasCamera(
            DungeonMapViewportScale.baseGrid(),
            DungeonMapViewportScale.defaultZoom(),
            DungeonMapViewportScale.minimumZoom(),
            DungeonMapViewportScale.maximumZoom());
    private Viewport viewport = dungeonViewport(camera.viewport());
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
        return setViewport(dungeonViewport(camera.reset()));
    }

    Viewport panByPixels(double deltaX, double deltaY) {
        return setViewport(dungeonViewport(camera.panByPixels(deltaX, deltaY)));
    }

    Viewport zoomAround(double canvasX, double canvasY, double factor) {
        return setViewport(dungeonViewport(camera.zoomAround(canvasX, canvasY, factor)));
    }

    private Viewport setViewport(Viewport nextViewport) {
        viewport = nextViewport == null ? Viewport.initial() : nextViewport;
        zoom.set(viewport.zoom());
        return viewport;
    }

    private static Viewport dungeonViewport(MapCanvasViewport viewport) {
        return new Viewport(viewport.panX(), viewport.panY(), viewport.zoom());
    }

}
