package features.world.dungeonmap.canvas.base;

import features.world.dungeonmap.canvas.graph.DungeonGraphSceneRenderer;
import features.world.dungeonmap.canvas.grid.DungeonGridSceneRenderer;
import features.world.dungeonmap.model.DungeonLayout;
import javafx.geometry.Insets;
import javafx.geometry.Point2D;
import javafx.scene.canvas.Canvas;
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
    private DungeonViewMode viewMode = DungeonViewMode.GRID;
    private Point2D lastPointer;
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
        canvas.addEventHandler(MouseEvent.MOUSE_PRESSED, event ->
                lastPointer = new Point2D(event.getX(), event.getY()));
        canvas.addEventHandler(MouseEvent.MOUSE_DRAGGED, this::handleDrag);
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

    private void handleDrag(MouseEvent event) {
        if (lastPointer == null) {
            lastPointer = new Point2D(event.getX(), event.getY());
            return;
        }
        camera.panBy(event.getX() - lastPointer.getX(), event.getY() - lastPointer.getY());
        lastPointer = new Point2D(event.getX(), event.getY());
        redraw();
        stateListener.run();
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
        renderer.render(canvas.getGraphicsContext2D(), canvas.getWidth(), canvas.getHeight(), mapModel, camera, editorMode);
    }
}
