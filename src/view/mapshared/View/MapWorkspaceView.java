package src.view.mapshared.View;

import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.layout.BorderPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.StackPane;
import javafx.scene.layout.VBox;
import org.jspecify.annotations.Nullable;
import src.view.mapshared.Controller.MapCameraController;
import src.view.mapshared.Controller.MapPointerController;
import src.view.mapshared.Model.MapCellViewModel;
import src.view.mapshared.Model.MapWorkspaceRenderModel;
import src.view.mapshared.Model.MapWorkspaceTopology;

import java.util.Objects;
import java.util.function.Consumer;

/**
 * Reusable workspace for map editor and travel screens.
 */
public final class MapWorkspaceView extends BorderPane {

    private final Label titleLabel = new Label();
    private final Label subtitleLabel = new Label();
    private final Label modeBadge = new Label();
    private final Label statusLabel = new Label();
    private final Label summaryLabel = new Label();
    private final StackPane contentHost = new StackPane();
    private final MapCameraController cameraController = new MapCameraController();
    private final MapPointerController pointerController = new MapPointerController();
    private final MapTopologyRenderer squareRenderer = new SquareMapTopologyRenderer();

    private @Nullable MapWorkspaceRenderModel renderModel;

    public MapWorkspaceView() {
        getStyleClass().addAll("scene-pane", "map-workspace");
        setPadding(new Insets(8));
        configureChrome();
        setTop(buildHeader());
        setCenter(contentHost);
        setBottom(summaryLabel);
        BorderPane.setMargin(summaryLabel, new Insets(8, 0, 0, 0));
    }

    public void setCellSelectionListener(Consumer<MapCellViewModel> listener) {
        pointerController.setCellSelectionListener(listener);
    }

    public void show(MapWorkspaceRenderModel nextRenderModel) {
        this.renderModel = Objects.requireNonNull(nextRenderModel, "nextRenderModel");
        redraw();
    }

    private void configureChrome() {
        titleLabel.getStyleClass().add("large");
        subtitleLabel.getStyleClass().add("text-muted");
        modeBadge.getStyleClass().add("map-mode-badge");
        statusLabel.getStyleClass().add("map-status-label");
        summaryLabel.getStyleClass().add("text-muted");
        contentHost.getStyleClass().add("map-workspace-content");
        contentHost.setAlignment(Pos.CENTER_LEFT);
    }

    private HBox buildHeader() {
        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);
        HBox badgeRow = new HBox(8, modeBadge, statusLabel);
        VBox titleBox = new VBox(4, titleLabel, subtitleLabel, badgeRow);
        HBox cameraControls = buildCameraControls();
        HBox header = new HBox(8, titleBox, spacer, cameraControls);
        header.getStyleClass().add("map-workspace-header");
        header.setPadding(new Insets(0, 0, 8, 0));
        return header;
    }

    private HBox buildCameraControls() {
        Button zoomOutButton = panButton("-", cameraController::zoomOut);
        Button zoomInButton = panButton("+", cameraController::zoomIn);
        Button resetButton = panButton("Reset", cameraController::reset);
        HBox cameraControls = new HBox(
                4,
                panButton("\u2190", cameraController::panLeft),
                panButton("\u2191", cameraController::panUp),
                panButton("\u2193", cameraController::panDown),
                panButton("\u2192", cameraController::panRight),
                zoomOutButton,
                zoomInButton,
                resetButton);
        cameraControls.getStyleClass().add("map-camera-controls");
        return cameraControls;
    }

    private void redraw() {
        if (renderModel == null) {
            return;
        }
        titleLabel.setText(renderModel.title());
        subtitleLabel.setText(renderModel.subtitle() + "  Zoom " + String.format("%.1f", cameraController.zoom()) + "x");
        modeBadge.setText(renderModel.modeLabel());
        statusLabel.setText(renderModel.statusLabel());
        summaryLabel.setText(renderModel.summaryLabel());
        Region rendered = (Region) squareRenderer.render(renderModel, pointerController::notifyCellSelected);
        rendered.setScaleX(cameraController.zoom());
        rendered.setScaleY(cameraController.zoom());
        rendered.setTranslateX(cameraController.panX());
        rendered.setTranslateY(cameraController.panY());
        contentHost.getChildren().setAll(rendered);
    }

    private Button panButton(String label, Runnable action) {
        Button button = new Button(label);
        button.getStyleClass().addAll("compact", "flat");
        button.setOnAction(event -> {
            action.run();
            redraw();
        });
        return button;
    }
}
