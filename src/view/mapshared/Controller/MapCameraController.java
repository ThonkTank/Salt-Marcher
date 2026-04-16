package src.view.mapshared.Controller;

/**
 * Tiny view-local camera state owner for the shared map workspace.
 */
public final class MapCameraController {

    private double zoom = 1.0;
    private double panX;
    private double panY;

    public double zoom() {
        return zoom;
    }

    public double panX() {
        return panX;
    }

    public double panY() {
        return panY;
    }

    public void zoomIn() {
        zoom = Math.min(2.0, zoom + 0.1);
    }

    public void zoomOut() {
        zoom = Math.max(0.7, zoom - 0.1);
    }

    public void panLeft() {
        panX += 24.0;
    }

    public void panRight() {
        panX -= 24.0;
    }

    public void panUp() {
        panY += 24.0;
    }

    public void panDown() {
        panY -= 24.0;
    }

    public void reset() {
        zoom = 1.0;
        panX = 0.0;
        panY = 0.0;
    }
}
