package platform.ui.mapcanvas;

/** Feature-neutral camera state expressed in canvas scene units. */
public record MapCanvasViewport(double panX, double panY, double zoom, double sceneUnitPixels) {
    public MapCanvasViewport {
        panX = finiteOrZero(panX);
        panY = finiteOrZero(panY);
        zoom = positiveFinite(zoom, 1.0);
        sceneUnitPixels = positiveFinite(sceneUnitPixels, 1.0);
    }

    public double scaledSceneUnit() {
        return sceneUnitPixels * zoom;
    }

    public double sceneToScreenX(double sceneX) {
        return panX + sceneX * scaledSceneUnit();
    }

    public double sceneToScreenY(double sceneY) {
        return panY + sceneY * scaledSceneUnit();
    }

    public double screenToSceneX(double screenX) {
        return (screenX - panX) / scaledSceneUnit();
    }

    public double screenToSceneY(double screenY) {
        return (screenY - panY) / scaledSceneUnit();
    }

    public double normalizedOffset(double spacing, boolean horizontal) {
        double safeSpacing = positiveFinite(spacing, scaledSceneUnit());
        double offset = (horizontal ? panX : panY) % safeSpacing;
        return offset < 0.0 ? offset + safeSpacing : offset;
    }

    private static double finiteOrZero(double value) {
        return Double.isFinite(value) ? value : 0.0;
    }

    private static double positiveFinite(double value, double fallback) {
        return Double.isFinite(value) && value > 0.0 ? value : fallback;
    }
}
