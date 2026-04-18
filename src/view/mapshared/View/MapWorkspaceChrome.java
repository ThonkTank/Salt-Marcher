package src.view.mapshared.View;

import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.StackPane;
import javafx.scene.layout.VBox;
final class MapWorkspaceChrome {

    private static final double ZOOM_STEP_FACTOR = 1.1;

    private MapWorkspaceChrome() {
    }

    static void configureLabels(
            Label titleLabel,
            Label subtitleLabel,
            Label modeBadge,
            Label statusLabel,
            Label summaryLabel
    ) {
        titleLabel.getStyleClass().add("large");
        subtitleLabel.getStyleClass().add("text-muted");
        modeBadge.getStyleClass().add("map-mode-badge");
        statusLabel.getStyleClass().add("map-status-label");
        summaryLabel.getStyleClass().add("text-muted");
    }

    static void configureContentHost(StackPane contentHost) {
        contentHost.getStyleClass().add("map-workspace-content");
        contentHost.setAlignment(Pos.CENTER);
        contentHost.setFocusTraversable(true);
    }

    static HBox buildHeader(
            MapWorkspaceHeaderLabels labels,
            MapCameraController cameraController,
            MapWorkspaceCanvasMetrics canvasMetrics,
            Runnable onCameraChanged
    ) {
        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);
        HBox badgeRow = new HBox(8, labels.modeBadge(), labels.statusLabel());
        VBox titleBox = new VBox(4, labels.titleLabel(), labels.subtitleLabel(), badgeRow);
        HBox header = new HBox(8, titleBox, spacer, buildCameraControls(
                cameraController,
                canvasMetrics,
                onCameraChanged
        ));
        header.getStyleClass().add("map-workspace-header");
        header.setPadding(new Insets(0, 0, 8, 0));
        return header;
    }

    private static HBox buildCameraControls(
            MapCameraController cameraController,
            MapWorkspaceCanvasMetrics canvasMetrics,
            Runnable onCameraChanged
    ) {
        HBox cameraControls = new HBox(
                4,
                cameraButton("\u2190", () -> cameraController.panByTiles(-1.5, 0.0), onCameraChanged),
                cameraButton("\u2191", () -> cameraController.panByTiles(0.0, -1.5), onCameraChanged),
                cameraButton("\u2193", () -> cameraController.panByTiles(0.0, 1.5), onCameraChanged),
                cameraButton("\u2192", () -> cameraController.panByTiles(1.5, 0.0), onCameraChanged),
                cameraButton("-", () -> cameraController.zoomAround(
                        canvasMetrics.width() / 2.0,
                        canvasMetrics.height() / 2.0,
                        canvasMetrics.width(),
                        canvasMetrics.height(),
                        1.0 / ZOOM_STEP_FACTOR
                ), onCameraChanged),
                cameraButton("+", () -> cameraController.zoomAround(
                        canvasMetrics.width() / 2.0,
                        canvasMetrics.height() / 2.0,
                        canvasMetrics.width(),
                        canvasMetrics.height(),
                        ZOOM_STEP_FACTOR
                ), onCameraChanged),
                cameraButton("Reset", cameraController::reset, onCameraChanged)
        );
        cameraControls.getStyleClass().add("map-camera-controls");
        return cameraControls;
    }

    private static Button cameraButton(String label, Runnable action, Runnable onCameraChanged) {
        Button button = new Button(label);
        button.getStyleClass().addAll("compact", "flat");
        button.setOnAction(event -> {
            action.run();
            onCameraChanged.run();
        });
        return button;
    }
}
