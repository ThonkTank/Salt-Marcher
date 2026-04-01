package features.world.dungeonmap.canvas.base;

import features.world.dungeonmap.canvas.grid.DungeonGridSceneRenderer;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.TileShape;
import features.world.dungeonmap.model.geometry.VertexEdge;
import features.world.dungeonmap.shell.interaction.DungeonSelectionKey;
import features.world.dungeonmap.state.DungeonLevelOverlaySettings;
import features.world.dungeonmap.state.DungeonMapState;
import features.world.dungeonmap.state.EditorPreview;
import javafx.geometry.Insets;
import javafx.geometry.Point2D;
import javafx.scene.canvas.Canvas;
import javafx.scene.input.KeyCode;
import javafx.scene.input.KeyEvent;
import javafx.scene.input.MouseButton;
import javafx.scene.input.MouseEvent;
import javafx.scene.input.ScrollEvent;
import javafx.scene.layout.BorderPane;
import javafx.scene.layout.StackPane;

import java.util.Objects;
import java.util.Set;
import java.util.function.IntConsumer;

public final class DungeonCanvasWorkspace extends BorderPane {

    private static final DungeonCanvasInteractionHandler NOOP_HANDLER = new DungeonCanvasInteractionHandler() {
        @Override
        public boolean handlePressed(DungeonCanvasPointerEvent event, DungeonCanvasCamera camera) {
            return false;
        }

        @Override
        public boolean handleDragged(DungeonCanvasPointerEvent event, DungeonCanvasCamera camera) {
            return false;
        }

        @Override
        public boolean handleReleased(DungeonCanvasPointerEvent event, DungeonCanvasCamera camera) {
            return false;
        }
    };

    private final Canvas canvas = new Canvas();
    private final boolean editorMode;
    private final DungeonMapState mapState;
    private final DungeonCanvasCamera camera = new DungeonCanvasCamera();
    private final DungeonSceneRenderer gridRenderer = new DungeonGridSceneRenderer();

    private DungeonLayout mapModel = DungeonLayout.empty();
    private DungeonLayout previewMapModel;
    private DungeonViewMode viewMode = DungeonViewMode.GRID;
    private int projectionLevel;
    private DungeonLevelOverlaySettings levelOverlaySettings = DungeonLevelOverlaySettings.defaults();
    private String selectedTargetKey;
    private DungeonSelectionKey hoveredSelectionKey;
    private TileShape previewPaintShape = TileShape.empty();
    private boolean previewPaintDeleteMode;
    private Set<VertexEdge> previewBoundaryEdges = Set.of();
    private Set<VertexEdge> previewBoundarySkippedEdges = Set.of();
    private Point2i previewBoundaryStartVertex;
    private Point2i previewBoundaryCurrentVertex;
    private boolean previewBoundaryDeleteMode;
    private DungeonRuntimeRenderOverlay runtimeRenderOverlay = DungeonRuntimeRenderOverlay.empty();
    private DungeonCanvasInteractionHandler interactionHandler = NOOP_HANDLER;
    private Point2D lastPointer;
    private PointerCapture activePointerCapture = PointerCapture.NONE;
    private Runnable stateListener = () -> {};
    private IntConsumer levelScrollHandler;

    public DungeonCanvasWorkspace(boolean editorMode, DungeonMapState mapState) {
        this.editorMode = editorMode;
        this.mapState = Objects.requireNonNull(mapState, "mapState");
        this.mapModel = mapState.activeMap() == null ? DungeonLayout.empty() : mapState.activeMap();
        mapState.addListener(this::syncFromMapState);
        StackPane viewport = new StackPane(canvas);
        viewport.setPadding(new Insets(0));
        setCenter(viewport);

        canvas.setFocusTraversable(true);
        viewport.widthProperty().addListener((obs, oldValue, newValue) -> {
            canvas.setWidth(newValue.doubleValue());
            redraw();
        });
        viewport.heightProperty().addListener((obs, oldValue, newValue) -> {
            canvas.setHeight(newValue.doubleValue());
            redraw();
        });
        canvas.addEventHandler(MouseEvent.MOUSE_PRESSED, this::handlePress);
        canvas.addEventHandler(MouseEvent.MOUSE_MOVED, this::handleMove);
        canvas.addEventHandler(MouseEvent.MOUSE_DRAGGED, this::handleDrag);
        canvas.addEventHandler(MouseEvent.MOUSE_RELEASED, this::handleRelease);
        canvas.addEventHandler(MouseEvent.MOUSE_EXITED, this::handleExit);
        canvas.addEventHandler(ScrollEvent.SCROLL, this::handleScroll);
        canvas.addEventHandler(KeyEvent.KEY_PRESSED, this::handleKeyPress);
    }

    public void setViewMode(DungeonViewMode viewMode) {
        DungeonViewMode nextViewMode = viewMode == null ? DungeonViewMode.GRID : viewMode;
        if (this.viewMode == nextViewMode) {
            return;
        }
        this.viewMode = nextViewMode;
        notifyViewChanged();
    }

    public void setSelectedTargetKey(String selectedTargetKey) {
        if (Objects.equals(this.selectedTargetKey, selectedTargetKey)) {
            return;
        }
        this.selectedTargetKey = selectedTargetKey;
        notifyViewChanged();
    }

    public void setHoveredSelectionKey(DungeonSelectionKey hoveredSelectionKey) {
        if (Objects.equals(this.hoveredSelectionKey, hoveredSelectionKey)) {
            return;
        }
        this.hoveredSelectionKey = hoveredSelectionKey;
        notifyViewChanged();
    }

    public void showPreview(EditorPreview preview) {
        if (preview instanceof EditorPreview.LayoutPreview layoutPreview) {
            this.previewMapModel = layoutPreview.layout();
            this.previewPaintShape = TileShape.empty();
            this.previewPaintDeleteMode = false;
            clearBoundaryPreviewFields();
        } else if (preview instanceof EditorPreview.PaintPreview paintPreview) {
            this.previewMapModel = null;
            this.previewPaintShape = paintPreview.shape() == null ? TileShape.empty() : paintPreview.shape();
            this.previewPaintDeleteMode = paintPreview.deleteMode();
            clearBoundaryPreviewFields();
        } else if (preview instanceof EditorPreview.BoundaryPreview boundaryPreview) {
            this.previewMapModel = null;
            this.previewPaintShape = TileShape.empty();
            this.previewPaintDeleteMode = false;
            this.previewBoundaryEdges = boundaryPreview.edges() == null ? Set.of() : Set.copyOf(boundaryPreview.edges());
            this.previewBoundarySkippedEdges = boundaryPreview.skippedConnectionEdges() == null ? Set.of() : Set.copyOf(boundaryPreview.skippedConnectionEdges());
            this.previewBoundaryStartVertex = boundaryPreview.startVertex();
            this.previewBoundaryCurrentVertex = boundaryPreview.currentVertex();
            this.previewBoundaryDeleteMode = boundaryPreview.deleteMode();
        } else {
            this.previewMapModel = null;
            this.previewPaintShape = TileShape.empty();
            this.previewPaintDeleteMode = false;
            clearBoundaryPreviewFields();
        }
        notifyViewChanged();
    }

    public void clearPreview() {
        this.previewMapModel = null;
        this.previewPaintShape = TileShape.empty();
        this.previewPaintDeleteMode = false;
        clearBoundaryPreviewFields();
        notifyViewChanged();
    }

    private void clearBoundaryPreviewFields() {
        this.previewBoundaryEdges = Set.of();
        this.previewBoundarySkippedEdges = Set.of();
        this.previewBoundaryStartVertex = null;
        this.previewBoundaryCurrentVertex = null;
        this.previewBoundaryDeleteMode = false;
    }

    public void setOnLevelScrollRequested(IntConsumer handler) {
        this.levelScrollHandler = handler;
    }

    public void showRuntimeRenderOverlay(DungeonRuntimeRenderOverlay overlay) {
        DungeonRuntimeRenderOverlay nextOverlay = overlay == null
                ? DungeonRuntimeRenderOverlay.empty()
                : overlay;
        if (Objects.equals(this.runtimeRenderOverlay, nextOverlay)) {
            return;
        }
        this.runtimeRenderOverlay = nextOverlay;
        notifyViewChanged();
    }

    public void setInteractionHandler(DungeonCanvasInteractionHandler interactionHandler) {
        this.interactionHandler = interactionHandler == null ? NOOP_HANDLER : interactionHandler;
    }

    public void setOnStateChanged(Runnable stateListener) {
        this.stateListener = stateListener == null ? () -> {} : stateListener;
        this.stateListener.run();
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

    private void syncFromMapState() {
        setMapModel(mapState.activeMap());
        setProjectionLevel(mapState.activeProjectionLevel());
        setLevelOverlaySettings(mapState.levelOverlaySettings());
    }

    private void setMapModel(DungeonLayout mapModel) {
        DungeonLayout nextMapModel = mapModel == null ? DungeonLayout.empty() : mapModel;
        if (this.mapModel == nextMapModel) {
            return;
        }
        this.mapModel = nextMapModel;
        notifyViewChanged();
    }

    private void setProjectionLevel(int projectionLevel) {
        if (this.projectionLevel == projectionLevel) {
            return;
        }
        this.projectionLevel = projectionLevel;
        notifyViewChanged();
    }

    private void setLevelOverlaySettings(DungeonLevelOverlaySettings levelOverlaySettings) {
        DungeonLevelOverlaySettings nextSettings = levelOverlaySettings == null
                ? DungeonLevelOverlaySettings.defaults()
                : levelOverlaySettings;
        if (Objects.equals(this.levelOverlaySettings, nextSettings)) {
            return;
        }
        this.levelOverlaySettings = nextSettings;
        notifyViewChanged();
    }

    private void handlePress(MouseEvent event) {
        canvas.requestFocus();
        if (isInteractionPress(event) && interactionHandler.handlePressed(pointerEvent(event), camera)) {
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
            if (interactionHandler.handleDragged(pointerEvent(event), camera)) {
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

    private void handleMove(MouseEvent event) {
        if (activePointerCapture != PointerCapture.NONE) {
            return;
        }
        interactionHandler.handleMoved(pointerEvent(event), camera);
        stateListener.run();
    }

    private void handleRelease(MouseEvent event) {
        if (activePointerCapture == PointerCapture.INTERACTION) {
            interactionHandler.handleReleased(pointerEvent(event), camera);
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

    private void handleExit(MouseEvent event) {
        interactionHandler.handleExited();
        stateListener.run();
    }

    private void handleScroll(ScrollEvent event) {
        double axisDelta = Math.abs(event.getDeltaY()) >= Math.abs(event.getDeltaX())
                ? event.getDeltaY()
                : -event.getDeltaX();
        if (isLevelScrollGesture(event) && axisDelta != 0.0d) {
            int levelDelta = axisDelta > 0 ? 1 : -1;
            applyLevelChange(levelDelta);
            event.consume();
            return;
        }
        double factor = event.getDeltaY() >= 0 ? 1.1 : 1.0 / 1.1;
        camera.zoomAt(factor, event.getX(), event.getY());
        redraw();
        stateListener.run();
        event.consume();
    }

    private void handleKeyPress(KeyEvent event) {
        if (event.getCode() == KeyCode.SHIFT) {
            applyLevelChange(-1);
            event.consume();
        } else if (event.getCode() == KeyCode.CAPS) {
            applyLevelChange(1);
            event.consume();
        }
    }

    private void applyLevelChange(int levelDelta) {
        if (mapState.busy()) {
            return;
        }
        if (levelScrollHandler != null) {
            levelScrollHandler.accept(levelDelta);
        } else {
            mapState.setActiveProjectionLevel(mapState.activeProjectionLevel() + levelDelta);
        }
        interactionHandler.levelScrolled(levelDelta);
    }

    private boolean isLevelScrollGesture(ScrollEvent event) {
        return activePointerCapture == PointerCapture.INTERACTION || event.isControlDown();
    }

    private void redraw() {
        if (canvas.getWidth() <= 0 || canvas.getHeight() <= 0) {
            return;
        }
        DungeonLayout renderedLayout = renderedMapModel();
        gridRenderer.render(
                canvas.getGraphicsContext2D(),
                canvas.getWidth(),
                canvas.getHeight(),
                new DungeonSceneFrame(
                        renderedLayout,
                        renderedLayout.projectedToLevel(projectionLevel),
                        camera,
                        editorMode,
                        projectionLevel,
                        levelOverlaySettings,
                        new DungeonEditorRenderState(
                                selectedTargetKey,
                                hoveredSelectionKey,
                                previewPaintShape,
                                previewPaintDeleteMode,
                                previewBoundaryEdges,
                                previewBoundarySkippedEdges,
                                previewBoundaryStartVertex,
                                previewBoundaryCurrentVertex,
                                previewBoundaryDeleteMode),
                        runtimeRenderOverlay));
    }

    private void notifyViewChanged() {
        redraw();
        stateListener.run();
    }

    private DungeonLayout renderedMapModel() {
        DungeonLayout base = previewMapModel == null ? mapModel : previewMapModel;
        DungeonLayout resolved = base == null ? DungeonLayout.empty() : base;
        return resolved;
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
