package src.view.mapshared.Controller;

/**
 * Tiny view-local camera state owner for the shared map workspace.
 */
public final class MapCameraController {

    private double zoom = 1.0;

    public double zoom() {
        return zoom;
    }

    public void zoomIn() {
        zoom = Math.min(2.0, zoom + 0.1);
    }

    public void zoomOut() {
        zoom = Math.max(0.7, zoom - 0.1);
    }
}
