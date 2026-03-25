package features.world.dungeonmap.canvas.base;

import features.world.dungeonmap.application.runtime.DungeonRuntimeLocation;
import features.world.dungeonmap.canvas.graph.DungeonGraphSceneRenderer;
import features.world.dungeonmap.canvas.grid.DungeonGridSceneRenderer;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.TileShape;
import features.world.dungeonmap.model.geometry.VertexEdge;
import features.world.dungeonmap.state.DungeonLevelOverlaySettings;
import javafx.geometry.Insets;
import javafx.geometry.Point2D;
import javafx.scene.canvas.Canvas;
import javafx.scene.input.MouseButton;
import javafx.scene.input.MouseEvent;
import javafx.scene.input.ScrollEvent;
import javafx.scene.layout.BorderPane;
import javafx.scene.layout.StackPane;

import java.util.Objects;
import java.util.Set;
import java.util.function.IntConsumer;

public final class DungeonCanvasWorkspace extends BorderPane {

    private final Canvas canvas = new Canvas();
    private final boolean editorMode;
    private final DungeonCanvasCamera camera = new DungeonCanvasCamera();
    private final DungeonSceneRenderer gridRenderer = new DungeonGridSceneRenderer();
    private final DungeonSceneRenderer graphRenderer = new DungeonGraphSceneRenderer();

    private DungeonLayout mapModel = DungeonLayout.empty();
    private DungeonLayout previewMapModel;
    private DungeonViewMode viewMode = DungeonViewMode.GRID;
    private int projectionLevel;
    private DungeonLevelOverlaySettings levelOverlaySettings = DungeonLevelOverlaySettings.defaults();
    private String selectedTargetKey;
    private TileShape previewPaintShape = TileShape.empty();
    private boolean previewPaintDeleteMode;
    private Set<VertexEdge> previewBoundaryEdges = Set.of();
    private Set<VertexEdge> previewBoundarySkippedEdges = Set.of();
    private Point2i previewBoundaryStartVertex;
    private Point2i previewBoundaryCurrentVertex;
    private boolean previewBoundaryDeleteMode;
    private DungeonRuntimeLocation activeLocation;
    private CardinalDirection heading = CardinalDirection.defaultDirection();
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
    private IntConsumer levelScrollListener = ignored -> {};

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
        DungeonLayout nextMapModel = mapModel == null ? DungeonLayout.empty() : mapModel;
        if (this.mapModel == nextMapModel) {
            return;
        }
        this.mapModel = nextMapModel;
        notifyViewChanged();
    }

    public void setViewMode(DungeonViewMode viewMode) {
        DungeonViewMode nextViewMode = viewMode == null ? DungeonViewMode.GRID : viewMode;
        if (this.viewMode == nextViewMode) {
            return;
        }
        this.viewMode = nextViewMode;
        notifyViewChanged();
    }

    public void setProjectionLevel(int projectionLevel) {
        if (this.projectionLevel == projectionLevel) {
            return;
        }
        this.projectionLevel = projectionLevel;
        notifyViewChanged();
    }

    public void setPreviewMapModel(DungeonLayout previewMapModel) {
        if (this.previewMapModel == previewMapModel) {
            return;
        }
        this.previewMapModel = previewMapModel;
        notifyViewChanged();
    }

    public void setLevelOverlaySettings(DungeonLevelOverlaySettings levelOverlaySettings) {
        DungeonLevelOverlaySettings nextSettings = levelOverlaySettings == null
                ? DungeonLevelOverlaySettings.defaults()
                : levelOverlaySettings;
        if (Objects.equals(this.levelOverlaySettings, nextSettings)) {
            return;
        }
        this.levelOverlaySettings = nextSettings;
        notifyViewChanged();
    }

    public void setSelectedTargetKey(String selectedTargetKey) {
        if (Objects.equals(this.selectedTargetKey, selectedTargetKey)) {
            return;
        }
        this.selectedTargetKey = selectedTargetKey;
        notifyViewChanged();
    }

    public void setPreviewPaintShape(TileShape previewPaintShape, boolean deleteMode) {
        TileShape nextPreviewPaintShape = previewPaintShape == null ? TileShape.empty() : previewPaintShape;
        if (this.previewPaintShape.equals(nextPreviewPaintShape) && this.previewPaintDeleteMode == deleteMode) {
            return;
        }
        this.previewPaintShape = nextPreviewPaintShape;
        this.previewPaintDeleteMode = deleteMode;
        notifyViewChanged();
    }

    public void setPreviewBoundaryEdges(
            Set<VertexEdge> previewBoundaryEdges,
            Set<VertexEdge> previewBoundarySkippedEdges,
            Point2i previewBoundaryStartVertex,
            Point2i previewBoundaryCurrentVertex,
            boolean deleteMode
    ) {
        Set<VertexEdge> nextPreviewEdges = previewBoundaryEdges == null ? Set.of() : Set.copyOf(previewBoundaryEdges);
        Set<VertexEdge> nextSkippedEdges = previewBoundarySkippedEdges == null ? Set.of() : Set.copyOf(previewBoundarySkippedEdges);
        if (Objects.equals(this.previewBoundaryEdges, nextPreviewEdges)
                && Objects.equals(this.previewBoundarySkippedEdges, nextSkippedEdges)
                && Objects.equals(this.previewBoundaryStartVertex, previewBoundaryStartVertex)
                && Objects.equals(this.previewBoundaryCurrentVertex, previewBoundaryCurrentVertex)
                && this.previewBoundaryDeleteMode == deleteMode) {
            return;
        }
        this.previewBoundaryEdges = nextPreviewEdges;
        this.previewBoundarySkippedEdges = nextSkippedEdges;
        this.previewBoundaryStartVertex = previewBoundaryStartVertex;
        this.previewBoundaryCurrentVertex = previewBoundaryCurrentVertex;
        this.previewBoundaryDeleteMode = deleteMode;
        notifyViewChanged();
    }

    public void setActiveLocation(DungeonRuntimeLocation activeLocation) {
        if (Objects.equals(this.activeLocation, activeLocation)) {
            return;
        }
        this.activeLocation = activeLocation;
        notifyViewChanged();
    }

    public void setHeading(CardinalDirection heading) {
        CardinalDirection nextHeading = heading == null ? CardinalDirection.defaultDirection() : heading;
        if (this.heading == nextHeading) {
            return;
        }
        this.heading = nextHeading;
        notifyViewChanged();
    }

    public void setInteractionHandler(DungeonCanvasInteractionHandler interactionHandler) {
        this.interactionHandler = interactionHandler == null ? this.interactionHandler : interactionHandler;
    }

    public void setOnStateChanged(Runnable stateListener) {
        this.stateListener = stateListener == null ? () -> {} : stateListener;
        this.stateListener.run();
    }

    public void setOnLevelScrollRequested(IntConsumer levelScrollListener) {
        this.levelScrollListener = levelScrollListener == null ? ignored -> {} : levelScrollListener;
    }

    public void resetView() {
        camera.reset();
        notifyViewChanged();
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
                stateListener.run();
            }
            event.consume();
            return;
        }
        if (activePointerCapture != PointerCapture.PAN || !event.isMiddleButtonDown()) {
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
        double axisDelta = Math.abs(event.getDeltaY()) >= Math.abs(event.getDeltaX())
                ? event.getDeltaY()
                : -event.getDeltaX();
        if (activePointerCapture == PointerCapture.INTERACTION && axisDelta != 0.0d) {
            int levelDelta = axisDelta > 0 ? 1 : -1;
            if (interactionHandler.handleLevelScroll(levelDelta)) {
                event.consume();
                return;
            }
        }
        if (event.isShiftDown()) {
            if (axisDelta == 0.0d) {
                event.consume();
                return;
            }
            int levelDelta = axisDelta > 0 ? 1 : -1;
            levelScrollListener.accept(levelDelta);
            event.consume();
            return;
        }
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
                new DungeonRenderState(
                        selectedTargetKey,
                        previewPaintShape,
                        previewPaintDeleteMode,
                        previewBoundaryEdges,
                        previewBoundarySkippedEdges,
                        previewBoundaryStartVertex,
                        previewBoundaryCurrentVertex,
                        previewBoundaryDeleteMode,
                        projectionLevel,
                        levelOverlaySettings,
                        activeLocation,
                        heading));
    }

    private void notifyViewChanged() {
        redraw();
        stateListener.run();
    }

    private DungeonLayout renderedMapModel() {
        DungeonLayout base = previewMapModel == null ? mapModel : previewMapModel;
        DungeonLayout resolved = base == null ? DungeonLayout.empty() : base;
        return viewMode == DungeonViewMode.GRAPH ? resolved.projectedToLevel(projectionLevel) : resolved;
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
        return event.getButton() == MouseButton.PRIMARY || event.getButton() == MouseButton.SECONDARY;
    }

    private static boolean isPanPress(MouseEvent event) {
        return event.getButton() == MouseButton.MIDDLE;
    }

    private enum PointerCapture {
        NONE,
        INTERACTION,
        PAN
    }
}
