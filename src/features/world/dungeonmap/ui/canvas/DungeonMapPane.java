package features.world.dungeonmap.ui.canvas;

import features.world.dungeonmap.model.BrushShape;
import features.world.dungeonmap.model.DungeonEndpoint;
import features.world.dungeonmap.model.DungeonEdgeSummary;
import features.world.dungeonmap.model.DungeonLink;
import features.world.dungeonmap.model.DungeonLinkAnchor;
import features.world.dungeonmap.model.DungeonMapState;
import features.world.dungeonmap.model.DungeonSelection;
import features.world.dungeonmap.model.DungeonSquare;
import features.world.dungeonmap.model.DungeonSquarePaint;
import features.world.dungeonmap.model.DungeonWallEdit;
import features.world.dungeonmap.ui.editor.DungeonColorRenderMode;
import features.world.dungeonmap.ui.editor.controls.DungeonEditorTool;
import features.world.dungeonmap.ui.editor.controls.DungeonPaintMode;
import features.world.dungeonmap.ui.editor.controls.PassageEditorMode;
import features.world.dungeonmap.ui.editor.controls.WallEditorMode;
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

    private final Canvas gridCanvas = new Canvas();
    private final Canvas selectionCanvas = new Canvas();
    private final Pane roomLabelsLayer = new Pane();
    private final Pane featuresLayer = new Pane();
    private final Pane linksLayer = new Pane();
    private final Pane endpointsLayer = new Pane();
    private final Label statusLabel = new Label("Kein Dungeon geladen");
    private String statusMessage = "Kein Dungeon geladen";

    private final DungeonCanvasModel model = new DungeonCanvasModel();
    private final DungeonViewport viewport = new DungeonViewport();
    private final DungeonGridRenderer gridRenderer = new DungeonGridRenderer(gridCanvas, selectionCanvas, model, viewport);
    private final DungeonOverlayRenderer overlayRenderer =
            new DungeonOverlayRenderer(roomLabelsLayer, featuresLayer, linksLayer, endpointsLayer, model, viewport);
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
        linksLayer.prefWidthProperty().bind(widthProperty());
        linksLayer.prefHeightProperty().bind(heightProperty());
        endpointsLayer.prefWidthProperty().bind(widthProperty());
        endpointsLayer.prefHeightProperty().bind(heightProperty());
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
                linksLayer,
                endpointsLayer,
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

    public void setPaintModeSupplier(Supplier<DungeonPaintMode> supplier) {
        interactionController.setPaintModeSupplier(supplier);
    }

    public void setActiveTool(DungeonEditorTool tool) {
        interactionController.setActiveTool(tool);
    }

    public void setColorRenderMode(DungeonColorRenderMode mode) {
        gridRenderer.setColorRenderMode(mode);
        overlayRenderer.setColorRenderMode(mode);
        gridRenderer.redrawGrid();
        gridRenderer.redrawSelection();
        overlayRenderer.repositionOverlays(this);
    }

    public void setWallEditorModeSupplier(Supplier<WallEditorMode> supplier) {
        interactionController.setWallEditorModeSupplier(supplier);
    }

    public void setPassageEditorModeSupplier(Supplier<PassageEditorMode> supplier) {
        interactionController.setPassageEditorModeSupplier(supplier);
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

    public void setShowLinks(boolean showLinks) {
        overlayRenderer.setShowLinks(showLinks);
    }

    public void setShowEndpoints(boolean showEndpoints) {
        overlayRenderer.setShowEndpoints(showEndpoints);
    }

    public void setShowFeatures(boolean showFeatures) {
        overlayRenderer.setShowFeatures(showFeatures);
    }

    public void setSelectedSelection(DungeonSelection selection) {
        model.setSelection(selection);
        gridRenderer.redrawSelection();
        overlayRenderer.refreshLinkStyles();
        overlayRenderer.refreshEndpointStyles();
    }

    public void setPendingLinkStart(DungeonLinkAnchor anchor) {
        model.setPendingLinkStart(anchor);
        gridRenderer.redrawSelection();
        overlayRenderer.refreshEndpointStyles();
    }

    public void setPartyEndpoint(Long endpointId) {
        model.setPartyEndpointId(endpointId);
        overlayRenderer.refreshEndpointStyles();
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

    public void setOnEndpointClicked(Consumer<DungeonEndpoint> onEndpointClicked) {
        overlayRenderer.setOnEndpointClicked(onEndpointClicked);
    }

    public void setOnLinkClicked(Consumer<DungeonLink> onLinkClicked) {
        overlayRenderer.setOnLinkClicked(onLinkClicked);
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
