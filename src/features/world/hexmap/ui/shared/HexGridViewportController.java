package features.world.hexmap.ui.shared;

import features.world.hexmap.model.HexTile;
import javafx.beans.value.ChangeListener;
import javafx.scene.Group;
import javafx.scene.layout.Pane;

import java.util.List;
import java.util.function.BooleanSupplier;
import java.util.function.ToDoubleFunction;

/**
 * Kapselt Pan/Zoom inkl. Initialzentrierung fuer ein Hex-Grid.
 * Entkoppelt Viewport-Interaktion von Rendering- und Tile-Logik.
 */
final class HexGridViewportController {

    private static final double MIN_ZOOM = 0.2;
    private static final double MAX_ZOOM = 5.0;

    private final Pane host;
    private final Group hexGroup;
    private final BooleanSupplier paintModeSupplier;
    private final Runnable onPaintStrokeFinished;

    private double dragStartX;
    private double dragStartY;
    private double translateX;
    private double translateY;
    private double zoomScale = 1.0;

    private List<HexTile> pendingCenterTiles;
    private ToDoubleFunction<HexTile> pendingCenterX;
    private ToDoubleFunction<HexTile> pendingCenterY;
    private ChangeListener<Number> pendingCenterSizeListener;

    HexGridViewportController(
            Pane host,
            Group hexGroup,
            BooleanSupplier paintModeSupplier,
            Runnable onPaintStrokeFinished
    ) {
        this.host = host;
        this.hexGroup = hexGroup;
        this.paintModeSupplier = paintModeSupplier;
        this.onPaintStrokeFinished = onPaintStrokeFinished;
        setupPanZoom();
    }

    void centerOnTiles(
            List<HexTile> tiles,
            ToDoubleFunction<HexTile> centerX,
            ToDoubleFunction<HexTile> centerY
    ) {
        if (tiles == null || tiles.isEmpty()) {
            clearPendingCenterRequest();
            return;
        }
        pendingCenterTiles = tiles;
        pendingCenterX = centerX;
        pendingCenterY = centerY;
        tryApplyPendingCenterRequest();
    }

    private void tryApplyPendingCenterRequest() {
        if (pendingCenterTiles == null || pendingCenterTiles.isEmpty()) {
            clearPendingCenterRequest();
            return;
        }

        double width = host.getWidth();
        double height = host.getHeight();
        if (width <= 0 || height <= 0) {
            ensurePendingCenterSizeListener();
            return;
        }

        double sumX = 0;
        double sumY = 0;
        for (HexTile tile : pendingCenterTiles) {
            sumX += pendingCenterX.applyAsDouble(tile);
            sumY += pendingCenterY.applyAsDouble(tile);
        }

        double centerX = sumX / pendingCenterTiles.size();
        double centerY = sumY / pendingCenterTiles.size();

        zoomScale = 1.0;
        translateX = width / 2.0 - centerX;
        translateY = height / 2.0 - centerY;
        applyTransform();

        clearPendingCenterRequest();
    }

    private void ensurePendingCenterSizeListener() {
        if (pendingCenterSizeListener != null) {
            return;
        }
        pendingCenterSizeListener = (obs, oldValue, newValue) -> tryApplyPendingCenterRequest();
        host.widthProperty().addListener(pendingCenterSizeListener);
        host.heightProperty().addListener(pendingCenterSizeListener);
    }

    private void clearPendingCenterRequest() {
        pendingCenterTiles = null;
        pendingCenterX = null;
        pendingCenterY = null;
        if (pendingCenterSizeListener != null) {
            host.widthProperty().removeListener(pendingCenterSizeListener);
            host.heightProperty().removeListener(pendingCenterSizeListener);
            pendingCenterSizeListener = null;
        }
    }

    private void setupPanZoom() {
        // Lokale Pane-Koordinaten fuer Drag und Zoom nutzen, damit das Verhalten
        // unabhaengig von Parent-Transforms oder SplitPane-Insets korrekt bleibt.
        host.setOnMousePressed(e -> {
            dragStartX = e.getX() - translateX;
            dragStartY = e.getY() - translateY;
        });

        host.setOnMouseReleased(e -> {
            if (paintModeSupplier.getAsBoolean()) {
                onPaintStrokeFinished.run();
            }
        });

        host.setOnMouseDragged(e -> {
            if (paintModeSupplier.getAsBoolean() && e.isPrimaryButtonDown()) return; // malen statt pannen
            translateX = e.getX() - dragStartX;
            translateY = e.getY() - dragStartY;
            applyTransform();
        });

        host.setOnScroll(e -> {
            double requestedFactor = e.getDeltaY() > 0 ? 1.1 : 0.9;
            double oldScale = zoomScale;
            double newScale = clamp(oldScale * requestedFactor, MIN_ZOOM, MAX_ZOOM);
            double effectiveFactor = newScale / oldScale;

            zoomScale = newScale;
            // In Richtung Cursorposition zoomen (lokale Koordinaten).
            translateX = e.getX() - effectiveFactor * (e.getX() - translateX);
            translateY = e.getY() - effectiveFactor * (e.getY() - translateY);
            applyTransform();
        });
    }

    private void applyTransform() {
        hexGroup.setTranslateX(translateX);
        hexGroup.setTranslateY(translateY);
        hexGroup.setScaleX(zoomScale);
        hexGroup.setScaleY(zoomScale);
    }

    private static double clamp(double value, double min, double max) {
        return Math.max(min, Math.min(max, value));
    }
}
