package features.world.dungeonmap.ui.canvas;

import features.world.dungeonmap.model.BrushShape;
import features.world.dungeonmap.model.DungeonEndpoint;
import features.world.dungeonmap.model.DungeonLink;
import features.world.dungeonmap.model.DungeonMapState;
import features.world.dungeonmap.model.DungeonPassage;
import features.world.dungeonmap.model.DungeonSelection;
import features.world.dungeonmap.model.DungeonSquare;
import features.world.dungeonmap.model.DungeonSquarePaint;
import features.world.dungeonmap.model.PassageDirection;
import features.world.dungeonmap.ui.editor.controls.DungeonEditorTool;
import javafx.scene.canvas.Canvas;
import javafx.scene.layout.Pane;
import javafx.scene.layout.StackPane;

import java.util.function.Consumer;
import java.util.function.Supplier;

public class DungeonMapPane extends StackPane {

    public record CellInteraction(int x, int y, DungeonSquare square) {}
    public record EdgeInteraction(int x, int y, PassageDirection direction, DungeonPassage existingPassage) {}

    private final Canvas gridCanvas = new Canvas();
    private final Canvas selectionCanvas = new Canvas();
    private final Pane linksLayer = new Pane();
    private final Pane endpointsLayer = new Pane();

    private final DungeonCanvasModel model = new DungeonCanvasModel();
    private final DungeonViewport viewport = new DungeonViewport();
    private final DungeonGridRenderer gridRenderer = new DungeonGridRenderer(gridCanvas, selectionCanvas, model, viewport);
    private final DungeonOverlayRenderer overlayRenderer = new DungeonOverlayRenderer(linksLayer, endpointsLayer, model, viewport);
    private final DungeonInteractionController interactionController =
            new DungeonInteractionController(selectionCanvas, model, viewport, this::redrawAll);

    public DungeonMapPane() {
        getStyleClass().add("dungeon-map-canvas");
        setMinSize(200, 200);

        gridCanvas.widthProperty().bind(widthProperty());
        gridCanvas.heightProperty().bind(heightProperty());
        selectionCanvas.widthProperty().bind(widthProperty());
        selectionCanvas.heightProperty().bind(heightProperty());
        selectionCanvas.widthProperty().addListener((obs, oldValue, newValue) -> redrawAll());
        selectionCanvas.heightProperty().addListener((obs, oldValue, newValue) -> redrawAll());
        interactionController.setRedrawSelection(gridRenderer::redrawSelection);

        getChildren().addAll(gridCanvas, selectionCanvas, linksLayer, endpointsLayer);
    }

    public void loadState(DungeonMapState state) {
        boolean shouldFitViewport = model.loadState(state);
        overlayRenderer.rebuildNodes();
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

    public void setActiveTool(DungeonEditorTool tool) {
        interactionController.setActiveTool(tool);
    }

    public void setOnEdgeClicked(Consumer<EdgeInteraction> onEdgeClicked) {
        interactionController.setOnEdgeClicked(onEdgeClicked);
    }

    public void setShowLinks(boolean showLinks) {
        overlayRenderer.setShowLinks(showLinks);
    }

    public void setShowEndpoints(boolean showEndpoints) {
        overlayRenderer.setShowEndpoints(showEndpoints);
    }

    public void setSelectedSelection(DungeonSelection selection) {
        model.setSelection(selection);
        gridRenderer.redrawSelection();
        overlayRenderer.refreshLinkStyles();
        overlayRenderer.refreshEndpointStyles();
    }

    public void setPendingLinkStart(Long endpointId) {
        model.setPendingLinkStartId(endpointId);
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

    private void redrawAll() {
        gridRenderer.redrawGrid();
        gridRenderer.redrawSelection();
        overlayRenderer.repositionOverlays(this);
    }
}
