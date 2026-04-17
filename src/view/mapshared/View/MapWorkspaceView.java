package src.view.mapshared.View;

import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.input.KeyCode;
import javafx.scene.input.KeyEvent;
import javafx.scene.input.MouseButton;
import javafx.scene.input.MouseEvent;
import javafx.scene.input.ScrollEvent;
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
import src.view.mapshared.Model.MapViewport;
import src.view.mapshared.Model.MapWorkspaceRenderModel;

import java.util.Objects;
import java.util.function.IntConsumer;
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

    private Consumer<MapViewport> viewportListener = ignored -> {
    };
    private IntConsumer floorStepListener = ignored -> {
    };
    private @Nullable MapWorkspaceRenderModel renderModel;
    private double lastDragX;
    private double lastDragY;
    private boolean middleDragActive;

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

    public void setViewportListener(Consumer<MapViewport> listener) {
        this.viewportListener = listener == null ? ignored -> {
        } : listener;
    }

    public void setFloorStepListener(IntConsumer listener) {
        this.floorStepListener = listener == null ? ignored -> {
        } : listener;
    }

    public MapViewport currentViewport() {
        return cameraController.currentViewport(resolveCanvasWidth(), resolveCanvasHeight());
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
        contentHost.setAlignment(Pos.CENTER);
        contentHost.setFocusTraversable(true);
        contentHost.addEventFilter(MouseEvent.MOUSE_PRESSED, this::handleMousePressed);
        contentHost.addEventFilter(MouseEvent.MOUSE_DRAGGED, this::handleMouseDragged);
        contentHost.addEventFilter(MouseEvent.MOUSE_RELEASED, this::handleMouseReleased);
        contentHost.addEventFilter(ScrollEvent.SCROLL, this::handleScroll);
        contentHost.addEventFilter(KeyEvent.KEY_PRESSED, this::handleKeyPressed);
        contentHost.widthProperty().addListener((ignored, before, after) -> handleViewportGeometryChanged());
        contentHost.heightProperty().addListener((ignored, before, after) -> handleViewportGeometryChanged());
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
        Button zoomOutButton = panButton("-", () -> cameraController.zoomOutAt(resolveCanvasWidth() / 2.0, resolveCanvasHeight() / 2.0, resolveCanvasWidth(), resolveCanvasHeight()));
        Button zoomInButton = panButton("+", () -> cameraController.zoomInAt(resolveCanvasWidth() / 2.0, resolveCanvasHeight() / 2.0, resolveCanvasWidth(), resolveCanvasHeight()));
        Button resetButton = panButton("Reset", cameraController::reset);
        HBox cameraControls = new HBox(
                4,
                panButton("\u2190", () -> cameraController.panByTiles(-1.5, 0.0)),
                panButton("\u2191", () -> cameraController.panByTiles(0.0, -1.5)),
                panButton("\u2193", () -> cameraController.panByTiles(0.0, 1.5)),
                panButton("\u2192", () -> cameraController.panByTiles(1.5, 0.0)),
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
        Node rendered = squareRenderer.render(renderModel, currentViewport());
        contentHost.getChildren().setAll(rendered);
    }

    private Button panButton(String label, Runnable action) {
        Button button = new Button(label);
        button.getStyleClass().addAll("compact", "flat");
        button.setOnAction(event -> {
            action.run();
            notifyViewportChanged();
            redraw();
        });
        return button;
    }

    private void handleMousePressed(MouseEvent event) {
        contentHost.requestFocus();
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
        notifyViewportChanged();
        redraw();
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
            cameraController.zoomInAt(event.getX(), event.getY(), resolveCanvasWidth(), resolveCanvasHeight());
        } else if (event.getDeltaY() < 0.0) {
            cameraController.zoomOutAt(event.getX(), event.getY(), resolveCanvasWidth(), resolveCanvasHeight());
        }
        notifyViewportChanged();
        redraw();
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
            floorStepListener.accept(1);
            event.consume();
            return;
        } else if (event.getCode() == KeyCode.CAPS) {
            floorStepListener.accept(-1);
            event.consume();
            return;
        } else {
            return;
        }
        notifyViewportChanged();
        redraw();
        event.consume();
    }

    private void handleViewportGeometryChanged() {
        if (renderModel == null) {
            return;
        }
        notifyViewportChanged();
        redraw();
    }

    private void notifyViewportChanged() {
        if (renderModel != null && renderModel.mapLoaded()) {
            viewportListener.accept(currentViewport());
        }
    }

    private double resolveCanvasWidth() {
        return contentHost.getWidth() > 1.0 ? contentHost.getWidth() : 960.0;
    }

    private double resolveCanvasHeight() {
        return contentHost.getHeight() > 1.0 ? contentHost.getHeight() : 640.0;
    }
}
