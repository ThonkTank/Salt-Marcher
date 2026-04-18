package src.view.mapshared.View;

import javafx.scene.input.KeyCode;
import javafx.scene.input.KeyEvent;
import javafx.scene.input.MouseButton;
import javafx.scene.input.MouseEvent;
import javafx.scene.input.ScrollEvent;
import javafx.scene.layout.StackPane;
final class MapWorkspaceInteractionHandler {

    private final MapCameraController cameraController;
    private final MapWorkspaceInteractionCallbacks callbacks;

    private double lastDragX;
    private double lastDragY;
    private boolean middleDragActive;

    MapWorkspaceInteractionHandler(
            StackPane contentHost,
            MapCameraController cameraController,
            MapWorkspaceInteractionCallbacks callbacks
    ) {
        this.cameraController = cameraController;
        this.callbacks = callbacks;
        contentHost.addEventFilter(MouseEvent.MOUSE_CLICKED, this::handleMouseClicked);
        contentHost.addEventFilter(MouseEvent.MOUSE_PRESSED, this::handleMousePressed);
        contentHost.addEventFilter(MouseEvent.MOUSE_DRAGGED, this::handleMouseDragged);
        contentHost.addEventFilter(MouseEvent.MOUSE_RELEASED, this::handleMouseReleased);
        contentHost.addEventFilter(ScrollEvent.SCROLL, this::handleScroll);
        contentHost.addEventFilter(KeyEvent.KEY_PRESSED, this::handleKeyPressed);
        contentHost.widthProperty().addListener((ignored, before, after) ->
                handleViewportGeometryChanged(before.doubleValue(), after.doubleValue()));
        contentHost.heightProperty().addListener((ignored, before, after) ->
                handleViewportGeometryChanged(before.doubleValue(), after.doubleValue()));
    }

    private void handleMouseClicked(MouseEvent event) {
        if (event.getButton() != MouseButton.PRIMARY || middleDragActive) {
            return;
        }
        callbacks.onPrimaryClick(event.getX(), event.getY());
        event.consume();
    }

    private void handleMousePressed(MouseEvent event) {
        ((StackPane) event.getSource()).requestFocus();
        if (event.getButton() == MouseButton.MIDDLE) {
            middleDragActive = true;
            lastDragX = event.getX();
            lastDragY = event.getY();
            event.consume();
        }
    }

    private void handleMouseDragged(MouseEvent event) {
        if (!middleDragActive) {
            return;
        }
        double dx = event.getX() - lastDragX;
        double dy = event.getY() - lastDragY;
        double tilesX = dx / cameraController.pixelsPerTile();
        double tilesY = dy / cameraController.pixelsPerTile();
        cameraController.panByTiles(-tilesX, -tilesY);
        lastDragX = event.getX();
        lastDragY = event.getY();
        callbacks.onViewportChanged();
        event.consume();
    }

    private void handleMouseReleased(MouseEvent event) {
        if (event.getButton() == MouseButton.MIDDLE) {
            middleDragActive = false;
            event.consume();
        }
    }

    private void handleScroll(ScrollEvent event) {
        if (event.getDeltaY() > 0.0) {
            cameraController.zoomAround(
                    event.getX(),
                    event.getY(),
                    callbacks.canvasMetrics().width(),
                    callbacks.canvasMetrics().height(),
                    1.1
            );
        } else if (event.getDeltaY() < 0.0) {
            cameraController.zoomAround(
                    event.getX(),
                    event.getY(),
                    callbacks.canvasMetrics().width(),
                    callbacks.canvasMetrics().height(),
                    1.0 / 1.1
            );
        }
        callbacks.onViewportChanged();
        event.consume();
    }

    private void handleKeyPressed(KeyEvent event) {
        if (event.getCode() == KeyCode.A) {
            cameraController.panByTiles(-1.5, 0.0);
        } else if (event.getCode() == KeyCode.D) {
            cameraController.panByTiles(1.5, 0.0);
        } else if (event.getCode() == KeyCode.W) {
            cameraController.panByTiles(0.0, -1.5);
        } else if (event.getCode() == KeyCode.S) {
            cameraController.panByTiles(0.0, 1.5);
        } else if (event.getCode() == KeyCode.TAB) {
            callbacks.onFloorStep(1);
            event.consume();
            return;
        } else if (event.getCode() == KeyCode.CAPS) {
            callbacks.onFloorStep(-1);
            event.consume();
            return;
        } else {
            return;
        }
        callbacks.onViewportChanged();
        event.consume();
    }

    private void handleViewportGeometryChanged(double before, double after) {
        if (!callbacks.mapLoaded()) {
            return;
        }
        if (after <= 1.0 || Math.abs(after - before) < 0.5) {
            return;
        }
        callbacks.onViewportGeometryChanged();
    }
}
