package features.world.quarantine.dungeonmap.canvas.viewport;

public final class DungeonCanvasCamera {

    private static final double SCREEN_PADDING = 28.0;
    private static final double MIN_ZOOM = 0.4;
    private static final double MAX_ZOOM = 4.0;

    private final double requestedCellSize;
    private DungeonCanvasBounds bounds = DungeonCanvasBounds.defaultBounds();
    private double viewportWidth;
    private double viewportHeight;
    private double baseCellSize = 1.0;
    private double baseOffsetX;
    private double baseOffsetY;
    private double zoomScale = 1.0;
    private double translateX;
    private double translateY;
    private double dragStartX;
    private double dragStartY;
    private double dragStartTranslateX;
    private double dragStartTranslateY;
    private boolean initialized;
    private long projectionVersion;

    public DungeonCanvasCamera(double requestedCellSize) {
        this.requestedCellSize = requestedCellSize;
    }

    public void showBounds(DungeonCanvasBounds bounds, double width, double height, boolean resetView) {
        this.bounds = bounds == null ? DungeonCanvasBounds.defaultBounds() : bounds;
        updateViewport(width, height, resetView || !initialized);
    }

    public void updateViewport(double width, double height, boolean resetView) {
        double previousViewportWidth = viewportWidth;
        double previousViewportHeight = viewportHeight;
        viewportWidth = width;
        viewportHeight = height;
        if (!hasUsableViewport()) {
            initialized = false;
            return;
        }

        double preservedWorldCenterX = initialized ? toWorldX(previousViewportWidth / 2.0) : bounds.centerX();
        double preservedWorldCenterY = initialized ? toWorldY(previousViewportHeight / 2.0) : bounds.centerY();

        recomputeBaseFit();
        if (resetView || !initialized) {
            zoomScale = 1.0;
            translateX = 0;
            translateY = 0;
        } else {
            translateX = viewportWidth / 2.0 - baseOffsetX - preservedWorldCenterX * effectiveCellSize();
            translateY = viewportHeight / 2.0 - baseOffsetY - preservedWorldCenterY * effectiveCellSize();
        }
        initialized = true;
        projectionVersion++;
    }

    public boolean isInitialized() {
        return initialized;
    }

    public void beginPan(double screenX, double screenY) {
        dragStartX = screenX;
        dragStartY = screenY;
        dragStartTranslateX = translateX;
        dragStartTranslateY = translateY;
    }

    public void updatePan(double screenX, double screenY) {
        translateX = dragStartTranslateX + (screenX - dragStartX);
        translateY = dragStartTranslateY + (screenY - dragStartY);
        projectionVersion++;
    }

    public void zoomAt(double screenX, double screenY, double factor) {
        if (!initialized) {
            return;
        }
        double worldX = toWorldX(screenX);
        double worldY = toWorldY(screenY);
        double newZoom = clamp(zoomScale * factor, MIN_ZOOM, MAX_ZOOM);
        zoomScale = newZoom;
        translateX = screenX - baseOffsetX - worldX * effectiveCellSize();
        translateY = screenY - baseOffsetY - worldY * effectiveCellSize();
        projectionVersion++;
    }

    public long projectionVersion() {
        return projectionVersion;
    }

    public double toScreenX(double worldX) {
        return baseOffsetX + translateX + worldX * effectiveCellSize();
    }

    public double toScreenY(double worldY) {
        return baseOffsetY + translateY + worldY * effectiveCellSize();
    }

    public double toWorldX(double screenX) {
        return (screenX - baseOffsetX - translateX) / effectiveCellSize();
    }

    public double toWorldY(double screenY) {
        return (screenY - baseOffsetY - translateY) / effectiveCellSize();
    }
    public int visibleMinWorldX() {
        return (int) Math.floor(Math.min(toWorldX(0), toWorldX(viewportWidth)));
    }

    public int visibleMaxWorldX() {
        return (int) Math.ceil(Math.max(toWorldX(0), toWorldX(viewportWidth)));
    }

    public int visibleMinWorldY() {
        return (int) Math.floor(Math.min(toWorldY(0), toWorldY(viewportHeight)));
    }

    public int visibleMaxWorldY() {
        return (int) Math.ceil(Math.max(toWorldY(0), toWorldY(viewportHeight)));
    }

    private boolean hasUsableViewport() {
        return viewportWidth > 1 && viewportHeight > 1;
    }

    private void recomputeBaseFit() {
        double availableWidth = Math.max(1, viewportWidth - SCREEN_PADDING * 2);
        double availableHeight = Math.max(1, viewportHeight - SCREEN_PADDING * 2);
        double worldWidth = Math.max(1.0, bounds.maxX() - bounds.minX());
        double worldHeight = Math.max(1.0, bounds.maxY() - bounds.minY());
        baseCellSize = Math.min(requestedCellSize,
                Math.min(availableWidth / worldWidth, availableHeight / worldHeight));
        baseOffsetX = SCREEN_PADDING - bounds.minX() * baseCellSize;
        baseOffsetY = SCREEN_PADDING - bounds.minY() * baseCellSize;
    }

    private double effectiveCellSize() {
        return Math.max(0.0001, baseCellSize * zoomScale);
    }

    private static double clamp(double value, double min, double max) {
        return Math.max(min, Math.min(max, value));
    }
}
