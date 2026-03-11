package features.world.dungeonmap.ui.canvas;

import features.world.dungeonmap.model.DungeonMapState;
import javafx.beans.value.ChangeListener;
import javafx.scene.layout.Region;

final class DungeonViewport {

    static final double CELL_SIZE = 28.0;

    private static final double MIN_ZOOM = 0.2;
    private static final double MAX_ZOOM = 2.5;
    private static final double VIEW_PADDING = 24.0;

    private double scale = 1.0;
    private double translateX = 24.0;
    private double translateY = 24.0;
    private double lastPanX;
    private double lastPanY;
    private boolean panning = false;
    private boolean viewportInitialized = false;
    private ChangeListener<Number> pendingFitSizeListener;

    void zoomAt(double x, double y, double deltaY) {
        double factor = deltaY > 0 ? 1.1 : 0.9;
        double oldScale = scale;
        scale = clamp(scale * factor, MIN_ZOOM, MAX_ZOOM);
        double effectiveFactor = scale / oldScale;
        translateX = x - effectiveFactor * (x - translateX);
        translateY = y - effectiveFactor * (y - translateY);
    }

    void startPan(double x, double y) {
        panning = true;
        lastPanX = x;
        lastPanY = y;
    }

    boolean isPanning() {
        return panning;
    }

    void panTo(double x, double y) {
        translateX += x - lastPanX;
        translateY += y - lastPanY;
        lastPanX = x;
        lastPanY = y;
    }

    void endPan() {
        panning = false;
    }

    void resetForMissingState(Region owner) {
        clearPendingFitRequest(owner);
        viewportInitialized = false;
    }

    void requestFitToViewport(Region owner, DungeonMapState state, Runnable redrawAll) {
        if (state == null || state.map() == null) {
            return;
        }
        if (owner.getWidth() <= 0 || owner.getHeight() <= 0) {
            ensurePendingFitSizeListener(owner, state, redrawAll);
            redrawAll.run();
            return;
        }
        clearPendingFitRequest(owner);
        fitToViewport(owner, state);
        viewportInitialized = true;
        redrawAll.run();
    }

    boolean shouldFitForLoadedState(boolean mapShapeChanged) {
        return !viewportInitialized || mapShapeChanged;
    }

    private void fitToViewport(Region owner, DungeonMapState state) {
        double availableWidth = Math.max(1.0, owner.getWidth() - VIEW_PADDING * 2.0);
        double availableHeight = Math.max(1.0, owner.getHeight() - VIEW_PADDING * 2.0);
        double mapPixelWidth = Math.max(1.0, state.map().width() * CELL_SIZE);
        double mapPixelHeight = Math.max(1.0, state.map().height() * CELL_SIZE);

        double fitScale = Math.min(availableWidth / mapPixelWidth, availableHeight / mapPixelHeight);
        scale = clamp(Math.min(1.0, fitScale), MIN_ZOOM, MAX_ZOOM);

        double scaledWidth = state.map().width() * CELL_SIZE * scale;
        double scaledHeight = state.map().height() * CELL_SIZE * scale;
        translateX = (owner.getWidth() - scaledWidth) / 2.0;
        translateY = (owner.getHeight() - scaledHeight) / 2.0;
    }

    private void ensurePendingFitSizeListener(Region owner, DungeonMapState state, Runnable redrawAll) {
        if (pendingFitSizeListener != null) {
            return;
        }
        pendingFitSizeListener = (obs, oldValue, newValue) -> {
            if (owner.getWidth() > 0 && owner.getHeight() > 0) {
                requestFitToViewport(owner, state, redrawAll);
            }
        };
        owner.widthProperty().addListener(pendingFitSizeListener);
        owner.heightProperty().addListener(pendingFitSizeListener);
    }

    void clearPendingFitRequest(Region owner) {
        if (pendingFitSizeListener == null) {
            return;
        }
        owner.widthProperty().removeListener(pendingFitSizeListener);
        owner.heightProperty().removeListener(pendingFitSizeListener);
        pendingFitSizeListener = null;
    }

    int cellX(double screenX) {
        return (int) Math.floor((screenX - translateX) / (CELL_SIZE * scale));
    }

    int cellY(double screenY) {
        return (int) Math.floor((screenY - translateY) / (CELL_SIZE * scale));
    }

    int minVisibleX(double width, int mapWidth) {
        return clamp((int) Math.floor((-translateX) / (CELL_SIZE * scale)), 0, mapWidth - 1);
    }

    int minVisibleY(double height, int mapHeight) {
        return clamp((int) Math.floor((-translateY) / (CELL_SIZE * scale)), 0, mapHeight - 1);
    }

    int maxVisibleX(double width, int mapWidth) {
        return clamp((int) Math.ceil((width - translateX) / (CELL_SIZE * scale)), 0, mapWidth - 1);
    }

    int maxVisibleY(double height, int mapHeight) {
        return clamp((int) Math.ceil((height - translateY) / (CELL_SIZE * scale)), 0, mapHeight - 1);
    }

    double screenX(int x) {
        return translateX + x * CELL_SIZE * scale;
    }

    double screenY(int y) {
        return translateY + y * CELL_SIZE * scale;
    }

    double screenCenterX(int x) {
        return screenX(x) + (CELL_SIZE * scale / 2.0) - 0.5;
    }

    double screenCenterY(int y) {
        return screenY(y) + (CELL_SIZE * scale / 2.0) - 0.5;
    }

    double scaledCellSize() {
        return CELL_SIZE * scale;
    }

    double strokeScale() {
        return scale;
    }

    boolean isVisible(Region owner, double x, double y, double radius) {
        return x + radius >= 0 && y + radius >= 0
                && x - radius <= owner.getWidth() && y - radius <= owner.getHeight();
    }

    boolean lineIntersectsViewport(Region owner, double x1, double y1, double x2, double y2) {
        double minX = Math.min(x1, x2);
        double maxX = Math.max(x1, x2);
        double minY = Math.min(y1, y2);
        double maxY = Math.max(y1, y2);
        return maxX >= 0 && maxY >= 0 && minX <= owner.getWidth() && minY <= owner.getHeight();
    }

    private static int clamp(int value, int min, int max) {
        if (max < min) {
            return min;
        }
        return Math.max(min, Math.min(max, value));
    }

    private static double clamp(double value, double min, double max) {
        return Math.max(min, Math.min(max, value));
    }
}
