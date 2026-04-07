package features.world.dungeon.canvas.base;

import features.world.dungeon.canvas.grid.DungeonGridSceneRenderer;
import features.world.dungeon.dungoenmap.model.DungeonMap;
import features.world.dungeon.geometry.GridPoint;
import features.world.dungeon.state.DungeonViewMode;
import features.world.dungeon.dungoenmap.state.DungeonLevelOverlaySettings;
import features.world.dungeon.dungoenmap.state.DungeonMapState;
import javafx.application.Platform;
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
import java.util.function.IntConsumer;

/**
 * Shared dungeon canvas workspace for both editor and runtime surfaces.
 *
 * <p>The workspace observes map state, coalesces redraws into scene frames, and owns raw canvas interaction. It does
 * not own dungeon semantics beyond rendering and input dispatch.</p>
 */
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

    private DungeonMap mapModel = DungeonMap.empty();
    private DungeonViewMode viewMode = DungeonViewMode.GRID;
    private int projectionLevel;
    private DungeonLevelOverlaySettings levelOverlaySettings = DungeonLevelOverlaySettings.defaults();
    private DungeonEditorRenderState editorRenderState = DungeonEditorRenderState.empty();
    private DungeonRuntimeRenderOverlay runtimeRenderOverlay = DungeonRuntimeRenderOverlay.empty();
    private DungeonCanvasInteractionHandler interactionHandler = NOOP_HANDLER;
    private Point2D lastPointer;
    private PointerCapture activePointerCapture = PointerCapture.NONE;
    private Runnable stateListener = () -> {};
    private IntConsumer levelScrollHandler;
    private boolean redrawScheduled;
    private boolean redrawDirty;

    public DungeonCanvasWorkspace(boolean editorMode, DungeonMapState mapState) {
        this.editorMode = editorMode;
        this.mapState = Objects.requireNonNull(mapState, "mapState");
        this.mapModel = mapState.activeMap() == null ? DungeonMap.empty() : mapState.activeMap();
        mapState.addListener(this::syncFromMapState);
        StackPane viewport = new StackPane(canvas);
        viewport.setPadding(new Insets(0));
        setCenter(viewport);

        canvas.setFocusTraversable(true);
        viewport.widthProperty().addListener((obs, oldValue, newValue) -> updateCanvasWidth(newValue.doubleValue()));
        viewport.heightProperty().addListener((obs, oldValue, newValue) -> updateCanvasHeight(newValue.doubleValue()));
        canvas.addEventHandler(MouseEvent.MOUSE_PRESSED, this::handlePress);
        canvas.addEventHandler(MouseEvent.MOUSE_MOVED, this::handleMove);
        canvas.addEventHandler(MouseEvent.MOUSE_DRAGGED, this::handleDrag);
        canvas.addEventHandler(MouseEvent.MOUSE_RELEASED, this::handleRelease);
        canvas.addEventHandler(MouseEvent.MOUSE_EXITED, this::handleExit);
        canvas.addEventHandler(ScrollEvent.SCROLL, this::handleScroll);
        canvas.addEventHandler(KeyEvent.KEY_PRESSED, this::handleKeyPress);
        syncFromMapState();
    }

    public void setViewMode(DungeonViewMode viewMode) {
        if (!applyViewMode(viewMode)) {
            return;
        }
        publishStateChange();
    }

    public void showEditorRenderState(DungeonEditorRenderState state) {
        if (!applyEditorRenderState(state)) {
            return;
        }
        publishStateChange();
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
        publishStateChange();
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
        publishStateChange();
    }

    public double zoom() {
        return camera.zoom();
    }

    public DungeonViewMode viewMode() {
        return viewMode;
    }

    private void syncFromMapState() {
        boolean changed = applyMapModel(mapState.activeMap());
        changed |= applyProjectionLevel(mapState.activeProjectionLevel());
        changed |= applyLevelOverlaySettings(mapState.levelOverlaySettings());
        if (changed) {
            publishStateChange();
        }
    }

    private boolean applyMapModel(DungeonMap mapModel) {
        DungeonMap nextMapModel = mapModel == null ? DungeonMap.empty() : mapModel;
        if (this.mapModel == nextMapModel) {
            return false;
        }
        this.mapModel = nextMapModel;
        return true;
    }

    private boolean applyProjectionLevel(int projectionLevel) {
        if (this.projectionLevel == projectionLevel) {
            return false;
        }
        this.projectionLevel = projectionLevel;
        return true;
    }

    private boolean applyLevelOverlaySettings(DungeonLevelOverlaySettings levelOverlaySettings) {
        DungeonLevelOverlaySettings nextSettings = levelOverlaySettings == null
                ? DungeonLevelOverlaySettings.defaults()
                : levelOverlaySettings;
        if (Objects.equals(this.levelOverlaySettings, nextSettings)) {
            return false;
        }
        this.levelOverlaySettings = nextSettings;
        return true;
    }

    private boolean applyViewMode(DungeonViewMode viewMode) {
        DungeonViewMode nextViewMode = viewMode == null ? DungeonViewMode.GRID : viewMode;
        if (this.viewMode == nextViewMode) {
            return false;
        }
        this.viewMode = nextViewMode;
        return true;
    }

    private boolean applyEditorRenderState(DungeonEditorRenderState state) {
        DungeonEditorRenderState nextState = state == null ? DungeonEditorRenderState.empty() : state;
        if (Objects.equals(this.editorRenderState, nextState)) {
            return false;
        }
        this.editorRenderState = nextState;
        return true;
    }

    private void handlePress(MouseEvent event) {
        canvas.requestFocus();
        if (isInteractionPress(event) && interactionHandler.handlePressed(pointerEvent(event), camera)) {
            activePointerCapture = PointerCapture.INTERACTION;
            lastPointer = null;
            requestRedraw();
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
                requestRedraw();
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
        requestRedraw();
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
            requestRedraw();
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
        requestRedraw();
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
        DungeonMap renderedLayout = renderedMapModel();
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
                        editorRenderState,
                        runtimeRenderOverlay));
    }

    public void requestRedraw() {
        redrawDirty = true;
        if (redrawScheduled) {
            return;
        }
        redrawScheduled = true;
        Platform.runLater(this::flushRedraw);
    }

    private void flushRedraw() {
        if (!redrawDirty) {
            redrawScheduled = false;
            return;
        }
        redrawDirty = false;
        redraw();
        if (redrawDirty) {
            Platform.runLater(this::flushRedraw);
            return;
        }
        redrawScheduled = false;
    }

    private void publishStateChange() {
        requestRedraw();
        stateListener.run();
    }

    private DungeonMap renderedMapModel() {
        DungeonMap base = editorRenderState.preview() instanceof features.world.dungeon.state.EditorPreview.LayoutPreview layoutPreview
                ? layoutPreview.layout()
                : mapModel;
        DungeonMap resolved = base == null ? DungeonMap.empty() : base;
        return resolved;
    }

    private void updateCanvasWidth(double width) {
        boolean becameDrawable = canvas.getWidth() <= 0.0 && width > 0.0 && canvas.getHeight() > 0.0;
        canvas.setWidth(width);
        if (becameDrawable) {
            redraw();
            return;
        }
        requestRedraw();
    }

    private void updateCanvasHeight(double height) {
        boolean becameDrawable = canvas.getHeight() <= 0.0 && height > 0.0 && canvas.getWidth() > 0.0;
        canvas.setHeight(height);
        if (becameDrawable) {
            redraw();
            return;
        }
        requestRedraw();
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

    private GridPoint cellAt(double canvasX, double canvasY) {
        double gridSize = DungeonCanvasTheme.BASE_GRID * camera.zoom();
        int cellX = (int) Math.floor((canvasX - camera.panX()) / gridSize);
        int cellY = (int) Math.floor((canvasY - camera.panY()) / gridSize);
        return GridPoint.cell(cellX, cellY, 0);
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
