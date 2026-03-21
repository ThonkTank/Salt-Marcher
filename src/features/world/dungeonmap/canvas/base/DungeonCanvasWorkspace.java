package features.world.dungeonmap.canvas.base;

import features.world.dungeonmap.canvas.graph.DungeonGraphSceneRenderer;
import features.world.dungeonmap.canvas.grid.DungeonGridSceneRenderer;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.TileShape;
import javafx.geometry.Insets;
import javafx.geometry.Point2D;
import javafx.scene.canvas.Canvas;
import javafx.scene.input.MouseButton;
import javafx.scene.input.MouseEvent;
import javafx.scene.input.ScrollEvent;
import javafx.scene.layout.BorderPane;
import javafx.scene.layout.StackPane;

public final class DungeonCanvasWorkspace extends BorderPane {

    private final Canvas canvas = new Canvas();
    private final boolean editorMode;
    private final DungeonCanvasCamera camera = new DungeonCanvasCamera();
    private final DungeonSceneRenderer gridRenderer = new DungeonGridSceneRenderer();
    private final DungeonSceneRenderer graphRenderer = new DungeonGraphSceneRenderer();

    private DungeonLayout mapModel = DungeonLayout.empty();
    private DungeonLayout previewMapModel;
    private DungeonViewMode viewMode = DungeonViewMode.GRID;
    private String selectedTargetKey;
    private TileShape previewPaintShape = TileShape.empty();
    private boolean previewPaintDeleteMode;
    private DungeonCanvasInteractionHandler interactionHandler = new DungeonCanvasInteractionHandler() {
        @Override
        public boolean handlePressed(DungeonCanvasPointerEvent event) {
            return false;
        }

        @Override
        public boolean handleDragged(DungeonCanvasPointerEvent event) {
            return false;
        }

        @Override
        public boolean handleReleased(DungeonCanvasPointerEvent event) {
            return false;
        }
    };
    private Point2D lastPointer;
    private PointerCapture activePointerCapture = PointerCapture.NONE;
    private Runnable stateListener = () -> {};

    public DungeonCanvasWorkspace(boolean editorMode, DungeonLayout mapModel) {
        this.editorMode = editorMode;
        this.mapModel = mapModel == null ? DungeonLayout.empty() : mapModel;
        StackPane viewport = new StackPane(canvas);
        viewport.setPadding(new Insets(0));
        setCenter(viewport);

        viewport.widthProperty().addListener((obs, oldValue, newValue) -> {
            canvas.setWidth(newValue.doubleValue());
            redraw();
        });
        viewport.heightProperty().addListener((obs, oldValue, newValue) -> {
            canvas.setHeight(newValue.doubleValue());
            redraw();
        });
        canvas.addEventHandler(MouseEvent.MOUSE_PRESSED, this::handlePress);
        canvas.addEventHandler(MouseEvent.MOUSE_DRAGGED, this::handleDrag);
        canvas.addEventHandler(MouseEvent.MOUSE_RELEASED, this::handleRelease);
        canvas.addEventHandler(ScrollEvent.SCROLL, this::handleScroll);
    }

    public void setMapModel(DungeonLayout mapModel) {
        this.mapModel = mapModel == null ? DungeonLayout.empty() : mapModel;
        redraw();
        stateListener.run();
    }

    public void setViewMode(DungeonViewMode viewMode) {
        this.viewMode = viewMode == null ? DungeonViewMode.GRID : viewMode;
        redraw();
        stateListener.run();
    }

    public void setPreviewMapModel(DungeonLayout previewMapModel) {
        this.previewMapModel = previewMapModel;
        redraw();
        stateListener.run();
    }

    public void setSelectedTargetKey(String selectedTargetKey) {
        this.selectedTargetKey = selectedTargetKey;
        redraw();
        stateListener.run();
    }

    public void setPreviewPaintShape(TileShape previewPaintShape, boolean deleteMode) {
        this.previewPaintShape = previewPaintShape == null ? TileShape.empty() : previewPaintShape;
        this.previewPaintDeleteMode = deleteMode;
        redraw();
        stateListener.run();
    }

    public void setInteractionHandler(DungeonCanvasInteractionHandler interactionHandler) {
        this.interactionHandler = interactionHandler == null ? this.interactionHandler : interactionHandler;
    }

    public void setOnStateChanged(Runnable stateListener) {
        this.stateListener = stateListener == null ? () -> {} : stateListener;
        this.stateListener.run();
    }

    public void resetView() {
        camera.reset();
        redraw();
        stateListener.run();
    }

    public double zoom() {
        return camera.zoom();
    }

    public DungeonViewMode viewMode() {
        return viewMode;
    }

    private void handlePress(MouseEvent event) {
        if (isInteractionPress(event) && interactionHandler.handlePressed(pointerEvent(event))) {
            activePointerCapture = PointerCapture.INTERACTION;
            lastPointer = null;
            redraw();
            stateListener.run();
            event.consume();
            return;
        }
        if (isPanPress(event)) {
            activePointerCapture = PointerCapture.PAN;
            lastPointer = new Point2D(event.getX(), event.getY());
            event.consume();
            return;
        }
        activePointerCapture = PointerCapture.NONE;
        lastPointer = new Point2D(event.getX(), event.getY());
    }

    private void handleDrag(MouseEvent event) {
        if (activePointerCapture == PointerCapture.INTERACTION) {
            if (interactionHandler.handleDragged(pointerEvent(event))) {
                redraw();
                stateListener.run();
            }
            event.consume();
            return;
        }
        if (activePointerCapture != PointerCapture.PAN || !event.isSecondaryButtonDown()) {
            return;
        }
        if (lastPointer == null) {
            lastPointer = new Point2D(event.getX(), event.getY());
            return;
        }
        camera.panBy(event.getX() - lastPointer.getX(), event.getY() - lastPointer.getY());
        lastPointer = new Point2D(event.getX(), event.getY());
        redraw();
        stateListener.run();
    }

    private void handleRelease(MouseEvent event) {
        if (activePointerCapture == PointerCapture.INTERACTION) {
            interactionHandler.handleReleased(pointerEvent(event));
            activePointerCapture = PointerCapture.NONE;
            lastPointer = null;
            redraw();
            stateListener.run();
            event.consume();
            return;
        }
        if (activePointerCapture == PointerCapture.PAN) {
            activePointerCapture = PointerCapture.NONE;
            lastPointer = null;
            event.consume();
            return;
        }
        activePointerCapture = PointerCapture.NONE;
        lastPointer = null;
    }

    private void handleScroll(ScrollEvent event) {
        double factor = event.getDeltaY() >= 0 ? 1.1 : 1.0 / 1.1;
        camera.zoomAt(factor, event.getX(), event.getY());
        redraw();
        stateListener.run();
        event.consume();
    }

    private void redraw() {
        if (canvas.getWidth() <= 0 || canvas.getHeight() <= 0) {
            return;
        }
        DungeonSceneRenderer renderer = viewMode == DungeonViewMode.GRAPH ? graphRenderer : gridRenderer;
        renderer.render(
                canvas.getGraphicsContext2D(),
                canvas.getWidth(),
                canvas.getHeight(),
                renderedMapModel(),
                camera,
                editorMode,
                selectedTargetKey,
                previewPaintShape,
                previewPaintDeleteMode);
    }

    private DungeonLayout renderedMapModel() {
        return previewMapModel == null ? mapModel : previewMapModel;
    }

    private DungeonCanvasPointerEvent pointerEvent(MouseEvent event) {
        return new DungeonCanvasPointerEvent(
                new Point2D(event.getX(), event.getY()),
                cellAt(event.getX(), event.getY()),
                camera,
                event.getButton(),
                event.isPrimaryButtonDown(),
                event.isSecondaryButtonDown(),
                event.isMiddleButtonDown());
    }

    private Point2i cellAt(double canvasX, double canvasY) {
        double gridSize = DungeonCanvasTheme.BASE_GRID * camera.zoom();
        int cellX = (int) Math.floor((canvasX - camera.panX()) / gridSize);
        int cellY = (int) Math.floor((canvasY - camera.panY()) / gridSize);
        return new Point2i(cellX, cellY);
    }

    private static boolean isInteractionPress(MouseEvent event) {
        return event.getButton() == MouseButton.PRIMARY;
    }

    private static boolean isPanPress(MouseEvent event) {
        return event.getButton() == MouseButton.SECONDARY;
    }

    private enum PointerCapture {
        NONE,
        INTERACTION,
        PAN
    }
}
