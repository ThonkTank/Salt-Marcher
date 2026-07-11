package src.view.slotcontent.main.dungeonmap;

import javafx.beans.property.ReadOnlyDoubleProperty;
import javafx.beans.property.ReadOnlyDoubleWrapper;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.Viewport;

final class DungeonMapViewportState {
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
        double nextZoom = DungeonMapViewportScale.clampZoom(viewport.zoom() * factor);
        double scale = nextZoom / viewport.zoom();
        return setViewport(new Viewport(
                canvasX - (canvasX - viewport.panX()) * scale,
                canvasY - (canvasY - viewport.panY()) * scale,
                nextZoom));
    }

    private Viewport setViewport(Viewport nextViewport) {
        viewport = nextViewport == null ? Viewport.initial() : nextViewport;
        zoom.set(viewport.zoom());
        return viewport;
    }

}
