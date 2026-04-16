package src.view.mapshared.View;

import javafx.geometry.Insets;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.layout.BorderPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;
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
    private final VBox contentBox = new VBox();
    private final MapCameraController cameraController = new MapCameraController();
    private final MapPointerController pointerController = new MapPointerController();
    private final MapTopologyRenderer squareRenderer = new SquareMapTopologyRenderer();

    private MapWorkspaceRenderModel renderModel;

    public MapWorkspaceView() {
        getStyleClass().add("scene-pane");
        setPadding(new Insets(8));

        titleLabel.getStyleClass().add("large");
        subtitleLabel.getStyleClass().add("text-muted");

        Button zoomOutButton = new Button("-");
        zoomOutButton.getStyleClass().addAll("compact", "flat");
        zoomOutButton.setOnAction(event -> {
            cameraController.zoomOut();
            redraw();
        });

        Button zoomInButton = new Button("+");
        zoomInButton.getStyleClass().addAll("compact", "flat");
        zoomInButton.setOnAction(event -> {
            cameraController.zoomIn();
            redraw();
        });

        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);

        HBox header = new HBox(8, new VBox(titleLabel, subtitleLabel), spacer, zoomOutButton, zoomInButton);
        header.setPadding(new Insets(0, 0, 8, 0));
        setTop(header);
        setCenter(contentBox);
    }

    public void setCellSelectionListener(Consumer<MapCellViewModel> listener) {
        pointerController.setCellSelectionListener(listener);
    }

    public void show(MapWorkspaceRenderModel nextRenderModel) {
        this.renderModel = Objects.requireNonNull(nextRenderModel, "nextRenderModel");
        redraw();
    }

    private void redraw() {
        if (renderModel == null) {
            return;
        }
        titleLabel.setText(renderModel.title());
        subtitleLabel.setText(renderModel.subtitle() + "  Zoom " + String.format("%.1f", cameraController.zoom()) + "x");
        MapTopologyRenderer renderer = resolveRenderer(renderModel);
        contentBox.getChildren().setAll(renderer.render(renderModel, pointerController::notifyCellSelected));
        contentBox.setScaleX(cameraController.zoom());
        contentBox.setScaleY(cameraController.zoom());
    }

    private MapTopologyRenderer resolveRenderer(MapWorkspaceRenderModel current) {
        if (current.topology() == MapWorkspaceTopology.HEX) {
            return squareRenderer;
        }
        return squareRenderer;
    }
}
