package features.world.dungeonmap.ui.shared.canvas;

import features.world.dungeonmap.model.domain.DungeonConnectionPoint;
import features.world.dungeonmap.model.editing.BrushShape;
import features.world.dungeonmap.model.projection.edge.DungeonEdgeSummary;
import features.world.dungeonmap.model.projection.DungeonMapState;
import features.world.dungeonmap.ui.shared.selection.DungeonSelection;
import features.world.dungeonmap.model.domain.DungeonSquare;
import features.world.dungeonmap.model.editing.DungeonSquarePaint;
import features.world.dungeonmap.model.editing.DungeonWallEdit;
import javafx.scene.canvas.Canvas;
import javafx.scene.control.Label;
import javafx.scene.layout.Pane;
import javafx.scene.layout.Region;
import javafx.scene.layout.StackPane;
import javafx.animation.PauseTransition;
import javafx.util.Duration;

import java.util.List;
import java.util.function.Consumer;
import java.util.function.Supplier;

public class DungeonMapPane extends StackPane {

    private static final Duration INVALID_EDGE_FLASH_DURATION = Duration.millis(500);

    public record CellInteraction(int x, int y, DungeonSquare square) {}
    public record EdgeInteraction(DungeonEdgeSummary edge) {}
    public record ConnectionPointMoveRequest(Long connectionId, int pointIndex, int x, int y) {}
    public record ConnectionPointInsertRequest(Long connectionId, int x, int y) {}
    public record ConnectionPointDeleteRequest(Long connectionId, int pointIndex) {}

    private final Canvas gridCanvas = new Canvas();
    private final Canvas selectionCanvas = new Canvas();
    private final Pane roomLabelsLayer = new Pane();
    private final Pane featuresLayer = new Pane();
    private final Pane connectionsLayer = new Pane();
    private final Label statusLabel = new Label("Kein Dungeon geladen");
    private String statusMessage = "Kein Dungeon geladen";

    private final DungeonCanvasModel model = new DungeonCanvasModel();
    private final DungeonViewport viewport = new DungeonViewport();
    private final DungeonGridRenderer gridRenderer = new DungeonGridRenderer(gridCanvas, selectionCanvas, model, viewport);
    private final DungeonOverlayRenderer overlayRenderer =
            new DungeonOverlayRenderer(roomLabelsLayer, featuresLayer, connectionsLayer, model, viewport);
    private final DungeonInteractionController interactionController =
            new DungeonInteractionController(selectionCanvas, model, viewport, this::redrawAll);
    private final PauseTransition invalidEdgeFlash = new PauseTransition(INVALID_EDGE_FLASH_DURATION);

    public DungeonMapPane() {
        getStyleClass().add("dungeon-map-canvas");
        setMinSize(200, 200);
        setPrefSize(Region.USE_COMPUTED_SIZE, Region.USE_COMPUTED_SIZE);
        setMaxSize(Double.MAX_VALUE, Double.MAX_VALUE);

        gridCanvas.widthProperty().bind(widthProperty());
        gridCanvas.heightProperty().bind(heightProperty());
        selectionCanvas.widthProperty().bind(widthProperty());
        selectionCanvas.heightProperty().bind(heightProperty());
        roomLabelsLayer.prefWidthProperty().bind(widthProperty());
        roomLabelsLayer.prefHeightProperty().bind(heightProperty());
        featuresLayer.prefWidthProperty().bind(widthProperty());
        featuresLayer.prefHeightProperty().bind(heightProperty());
        connectionsLayer.prefWidthProperty().bind(widthProperty());
        connectionsLayer.prefHeightProperty().bind(heightProperty());
        selectionCanvas.widthProperty().addListener((obs, oldValue, newValue) -> redrawAll());
        selectionCanvas.heightProperty().addListener((obs, oldValue, newValue) -> redrawAll());
        interactionController.setRedrawSelection(gridRenderer::redrawSelection);
        invalidEdgeFlash.setOnFinished(event -> {
            model.clearInvalidEdge();
            gridRenderer.redrawSelection();
        });
        statusLabel.getStyleClass().addAll("text-muted", "dungeon-map-empty-state");
        statusLabel.setMouseTransparent(true);
        updateStatusLabel();

        getChildren().addAll(
                gridCanvas,
                selectionCanvas,
                roomLabelsLayer,
                featuresLayer,
                connectionsLayer,
                statusLabel);
    }

    public void loadState(DungeonMapState state) {
        boolean shouldFitViewport = model.loadState(state);
        overlayRenderer.rebuildNodes();
        if (state == null || state.map() == null) {
            showEmptyState();
        } else {
            clearStatus();
        }
        if (state == null || state.map() == null) {
            viewport.resetForMissingState(this);
            redrawAll();
            return;
        }
        if (viewport.shouldFitForLoadedState(shouldFitViewport)) {
            viewport.requestFitToViewport(this, state, this::redrawAll);
        } else {
            viewport.clearPendingFitRequest(this);
            redrawAll();
        }
    }

    public void setBrushShapeSupplier(Supplier<BrushShape> supplier) {
        interactionController.setBrushShapeSupplier(supplier);
    }

    public void setBrushSizeSupplier(Supplier<Integer> supplier) {
        interactionController.setBrushSizeSupplier(supplier);
    }

    public void setPaintModeSupplier(Supplier<DungeonCanvasPaintMode> supplier) {
        interactionController.setPaintModeSupplier(supplier);
    }

    public void setActiveTool(DungeonCanvasTool tool) {
        interactionController.setActiveTool(tool);
    }

    public void setColorRenderMode(DungeonCanvasColorMode mode) {
        gridRenderer.setColorRenderMode(mode);
        overlayRenderer.setColorRenderMode(mode);
        gridRenderer.redrawGrid();
        gridRenderer.redrawSelection();
        overlayRenderer.repositionOverlays(this);
    }

    public void setWallModeSupplier(Supplier<DungeonCanvasWallMode> supplier) {
        interactionController.setWallModeSupplier(supplier);
    }

    public void setOnEdgeClicked(Consumer<EdgeInteraction> onEdgeClicked) {
        interactionController.setOnEdgeClicked(onEdgeClicked);
    }

    public void setOnEdgePainted(Consumer<EdgeInteraction> onEdgePainted) {
        interactionController.setOnEdgePainted(onEdgePainted);
    }

    public void setOnEdgePaintPathPreview(Consumer<List<EdgeInteraction>> onEdgePaintPathPreview) {
        interactionController.setOnEdgePaintPathPreview(onEdgePaintPathPreview);
    }

    public void setOnEdgePaintPathFinished(Consumer<List<EdgeInteraction>> onEdgePaintPathFinished) {
        interactionController.setOnEdgePaintPathFinished(onEdgePaintPathFinished);
    }

    public void setOnEdgeStrokeFinished(Runnable onEdgeStrokeFinished) {
        interactionController.setOnEdgeStrokeFinished(onEdgeStrokeFinished);
    }

    public void setShowFeatures(boolean showFeatures) {
        overlayRenderer.setShowFeatures(showFeatures);
    }

    public void setSelectedSelection(DungeonSelection selection) {
        model.setSelection(selection);
        gridRenderer.redrawSelection();
        overlayRenderer.refreshConnectionStyles();
    }

    public void setPartySquare(Long squareId) {
        model.setPartySquareId(squareId);
        gridRenderer.redrawSelection();
    }

    public void previewPaint(DungeonSquarePaint paint) {
        model.previewPaint(paint);
        gridRenderer.redrawVisibleCell(paint.x(), paint.y());
        gridRenderer.redrawSelection();
    }

    public void previewCommittedWallEdits(java.util.List<DungeonWallEdit> edits) {
        model.previewCommittedWallEdits(edits);
        redrawAll();
    }

    public void previewActiveWallPath(java.util.List<DungeonWallEdit> edits) {
        model.previewActiveWallPath(edits);
        redrawAll();
    }

    public void clearActiveWallPathPreview() {
        model.clearActiveWallPathPreview();
        redrawAll();
    }

    public void flashInvalidEdge(EdgeInteraction interaction) {
        if (interaction == null) {
            return;
        }
        model.setInvalidEdge(interaction.edge().x(), interaction.edge().y(), interaction.edge().direction());
        gridRenderer.redrawSelection();
        invalidEdgeFlash.stop();
        invalidEdgeFlash.playFromStart();
    }

    public void setOnCellClicked(Consumer<CellInteraction> onCellClicked) {
        interactionController.setOnCellClicked(onCellClicked);
    }

    public void setOnCellPainted(Consumer<CellInteraction> onCellPainted) {
        interactionController.setOnCellPainted(onCellPainted);
    }

    public void setOnConnectionClicked(Consumer<Long> onConnectionClicked) {
        overlayRenderer.setOnConnectionClicked(onConnectionClicked);
    }

    public void setOnConnectionPointMoved(Consumer<ConnectionPointMoveRequest> onConnectionPointMoved) {
        overlayRenderer.setOnConnectionPointMoved(onConnectionPointMoved);
    }

    public void setOnConnectionPointInserted(Consumer<ConnectionPointInsertRequest> onConnectionPointInserted) {
        overlayRenderer.setOnConnectionPointInserted(onConnectionPointInserted);
    }

    public void setOnConnectionPointDeleted(Consumer<ConnectionPointDeleteRequest> onConnectionPointDeleted) {
        overlayRenderer.setOnConnectionPointDeleted(onConnectionPointDeleted);
    }

    public void setOnFeatureClicked(Consumer<features.world.dungeonmap.model.domain.DungeonFeature> onFeatureClicked) {
        overlayRenderer.setOnFeatureClicked(onFeatureClicked);
    }

    public void setOnPaintStrokeFinished(Runnable onPaintStrokeFinished) {
        interactionController.setOnPaintStrokeFinished(onPaintStrokeFinished);
    }

    public void showEmptyState() {
        statusMessage = "Kein Dungeon geladen";
        updateStatusLabel();
    }

    public void showLoadError(String message) {
        statusMessage = message == null || message.isBlank()
                ? "Dungeon konnte nicht geladen werden"
                : message;
        updateStatusLabel();
    }

    public void clearStatus() {
        statusMessage = null;
        updateStatusLabel();
    }

    private void redrawAll() {
        gridRenderer.redrawGrid();
        gridRenderer.redrawSelection();
        overlayRenderer.repositionOverlays(this);
    }

    private void updateStatusLabel() {
        boolean showStatus = statusMessage != null && !statusMessage.isBlank();
        statusLabel.setText(showStatus ? statusMessage : "");
        statusLabel.setVisible(showStatus);
        statusLabel.setManaged(showStatus);
    }
}
