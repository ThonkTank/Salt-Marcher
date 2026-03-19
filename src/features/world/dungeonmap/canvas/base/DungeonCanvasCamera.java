package features.world.dungeonmap.canvas.base;

public final class DungeonCanvasCamera {

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

    public void reset() {
        zoom = 1.0;
        panX = 0.0;
        panY = 0.0;
    }

    public void panBy(double dx, double dy) {
        panX += dx;
        panY += dy;
    }

    public void zoomAt(double factor, double anchorX, double anchorY) {
        double nextZoom = clamp(zoom * factor, DungeonCanvasTheme.MIN_ZOOM, DungeonCanvasTheme.MAX_ZOOM);
        double scale = nextZoom / zoom;
        panX = anchorX - (anchorX - panX) * scale;
        panY = anchorY - (anchorY - panY) * scale;
        zoom = nextZoom;
    }

    private static double clamp(double value, double min, double max) {
        return Math.max(min, Math.min(max, value));
    }
}
