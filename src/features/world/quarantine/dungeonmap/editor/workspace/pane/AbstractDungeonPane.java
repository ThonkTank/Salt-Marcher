package features.world.quarantine.dungeonmap.editor.workspace.pane;

import features.world.quarantine.dungeonmap.layout.model.DungeonLayout;
import features.world.quarantine.dungeonmap.canvas.state.DungeonViewState;
import features.world.quarantine.dungeonmap.corridors.model.topology.CorridorGeometry;
import features.world.quarantine.dungeonmap.corridors.model.DungeonCorridor;
import features.world.quarantine.dungeonmap.corridors.model.DungeonCorridorEndpoint;
import features.world.quarantine.dungeonmap.layout.model.DungeonSelection;
import features.world.quarantine.dungeonmap.corridors.model.primitives.DoorSegment;
import features.world.quarantine.dungeonmap.rooms.model.DungeonRoom;
import features.world.quarantine.dungeonmap.rooms.model.DungeonRoomCluster;
import features.world.quarantine.dungeonmap.runtime.model.DungeonRuntimeLocation;
import features.world.quarantine.dungeonmap.foundation.geometry.Point2i;
import features.world.quarantine.dungeonmap.canvas.viewport.DungeonCanvasCamera;
import features.world.quarantine.dungeonmap.canvas.grid.DungeonGridSurface;
import features.world.quarantine.dungeonmap.canvas.state.DungeonLayoutRenderData;
import features.world.quarantine.dungeonmap.editor.selection.CorridorDoorHandle;
import features.world.quarantine.dungeonmap.editor.workspace.corridor.CorridorDoorHit;
import features.world.quarantine.dungeonmap.editor.workspace.corridor.DungeonCorridorDoorProjector;
import features.world.quarantine.dungeonmap.editor.workspace.preview.DungeonPanePreviewModel;
import features.world.quarantine.dungeonmap.editor.workspace.DungeonEditorTool;
import features.world.quarantine.dungeonmap.editor.workspace.DungeonPaneContext;
import features.world.quarantine.dungeonmap.editor.workspace.contract.DungeonPaneInteractionSink;
import features.world.quarantine.dungeonmap.editor.workspace.DungeonViewMode;
import features.world.quarantine.dungeonmap.editor.workspace.interaction.DungeonPaneHitTestProjection;
import features.world.quarantine.dungeonmap.editor.workspace.interaction.DungeonPaneInteractionServices;
import features.world.quarantine.dungeonmap.editor.workspace.interaction.DungeonPanePointerController;
import features.world.quarantine.dungeonmap.editor.workspace.interaction.DungeonPanePointerProjection;

import features.world.quarantine.dungeonmap.foundation.geometry.ScreenPoint;

import features.world.quarantine.dungeonmap.editor.workspace.preview.DungeonPaneSelectionAreaProjection;
import features.world.quarantine.dungeonmap.editor.workspace.wallpath.DungeonPaneWallPathProjection;
import javafx.scene.canvas.Canvas;
import javafx.scene.canvas.GraphicsContext;
import javafx.scene.input.KeyEvent;
import javafx.scene.input.MouseEvent;
import javafx.scene.input.ScrollEvent;
import javafx.scene.layout.StackPane;

import java.util.Objects;

public abstract class AbstractDungeonPane extends StackPane implements DungeonGridSurface, DungeonPanePointerProjection, DungeonPaneContext {

    protected final DungeonCanvasCamera camera;
    private final DungeonPaneSceneState sceneState = new DungeonPaneSceneState();
    private final DungeonPaneCanvasLifecycle canvasLifecycle;
    private DungeonPaneInteractionServices interactions;

    protected AbstractDungeonPane(DungeonCanvasCamera camera) {
        this.camera = Objects.requireNonNull(camera, "camera");
        this.canvasLifecycle = new DungeonPaneCanvasLifecycle(this, this::render);
    }

    protected final void initInteractions(
            DungeonPaneSelectionAreaProjection selectionAreaProjection,
            DungeonPaneWallPathProjection wallPathProjection,
            DungeonPaneInteractionSink interactionSink
    ) {
        this.interactions = new DungeonPaneInteractionServices(
                this,
                this,
                selectionAreaProjection,
                wallPathProjection,
                interactionSink);
        installEventHandlers(canvas());
        sceneState.setHoveredCorridorIdSupplier(
                () -> interactions.renderState().previewState().hoveredCorridorId());
    }

    private void installEventHandlers(Canvas canvas) {
        DungeonPanePointerController pc = interactions.pointerController();
        setFocusTraversable(true);
        addEventHandler(KeyEvent.KEY_PRESSED, pc::handleKeyPressed);
        canvas.addEventHandler(MouseEvent.MOUSE_PRESSED, event -> requestFocus());
        canvas.addEventHandler(MouseEvent.MOUSE_PRESSED, pc::handleMousePressed);
        canvas.addEventHandler(MouseEvent.MOUSE_MOVED, pc::handleMouseMoved);
        canvas.addEventHandler(MouseEvent.MOUSE_DRAGGED, pc::handleMouseDragged);
        canvas.addEventHandler(MouseEvent.MOUSE_RELEASED, pc::handleMouseReleased);
        canvas.addEventHandler(MouseEvent.MOUSE_EXITED, event -> pc.handlePointerExited());
        canvas.addEventHandler(ScrollEvent.SCROLL, pc::handleScroll);
    }

    public final void setEditable(boolean editable) {
        interactions.renderState().setEditable(editable);
    }

    public final void setEditorTool(DungeonEditorTool editorTool) {
        interactions.pointerController().setEditorTool(editorTool);
    }

    public final void showLayout(
            DungeonViewState viewState,
            DungeonLayoutRenderData renderData,
            boolean renderNow
    ) {
        setLayoutState(viewState, renderData);
        interactions.pointerController().handleLayoutShown(renderNow);
    }

    public final void updateSelection(DungeonViewState viewState, boolean renderNow) {
        setLayoutState(viewState, sceneState.renderData());
        interactions.pointerController().handleSelectionUpdated(renderNow);
    }

    public final CorridorDoorHandle selectedCorridorDoorHandle() {
        return interactions.corridorWorkspace().selectedCorridorDoorHandle();
    }

    public final void setSelectedCorridorDoorHandle(CorridorDoorHandle handle) {
        interactions.pointerController().setSelectedCorridorDoorHandle(handle);
    }

    public final void refreshViewport() {
        interactions.pointerController().refreshViewport();
    }

    @Override
    public void renderGrid(GraphicsContext gc, DungeonLayout layout, DungeonCanvasCamera camera) {
        render();
    }

    protected abstract void renderContent(GraphicsContext gc);

    @Override
    public abstract Point2i worldPointAt(double screenX, double screenY);

    public abstract DungeonPaneHitTestProjection hitTestDelegate();

    @Override
    public final DungeonPaneHitTestProjection hitTests() {
        return hitTestDelegate();
    }

    public abstract DungeonViewMode viewMode();

    public final void render() {
        canvasLifecycle.render(sceneState.layoutPresent(), this::renderContent);
    }

    public final void setLayoutState(
            DungeonViewState viewState,
            DungeonLayoutRenderData renderData
    ) {
        sceneState.setLayoutState(viewState, renderData);
    }

    public final void setEditorToolInternal(DungeonEditorTool editorTool) {
        interactions.renderState().setEditorTool(editorTool);
    }

    public final double worldX(double screenX) {
        return camera.toWorldX(screenX);
    }

    public final double worldY(double screenY) {
        return camera.toWorldY(screenY);
    }

    @Override
    public final DungeonLayout dungeonLayout() {
        return sceneState.layout();
    }


    @Override
    public final DungeonRoomCluster clusterById(long clusterId) {
        return sceneState.clusterById(clusterId);
    }

    @Override
    public final DungeonCanvasCamera camera() {
        return camera;
    }

    @Override
    public final boolean layoutPresent() {
        return sceneState.layoutPresent();
    }

    @Override
    public final DungeonPaneSceneState sceneState() {
        return sceneState;
    }

    public final DungeonPaneInteractionServices interactions() {
        return interactions;
    }

    @Override
    public final DungeonLayoutRenderData renderData() {
        return sceneState.renderData();
    }

    protected final javafx.scene.canvas.Canvas canvas() {
        return canvasLifecycle.canvas();
    }

    public final void rebuildClusterDragPreview() {
        interactions.previewModel().rebuildClusterDragPreview(sceneState.layout(), sceneState.renderData());
    }

}
