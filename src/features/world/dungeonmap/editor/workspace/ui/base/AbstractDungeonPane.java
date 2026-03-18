package features.world.dungeonmap.editor.workspace.ui.base;

import features.world.dungeonmap.layout.model.DungeonLayout;
import features.world.dungeonmap.view.model.DungeonViewState;
import features.world.dungeonmap.corridors.model.CorridorGeometry;
import features.world.dungeonmap.corridors.model.DungeonCorridor;
import features.world.dungeonmap.corridors.model.DungeonCorridorEndpoint;
import features.world.dungeonmap.view.model.DungeonSelection;
import features.world.dungeonmap.corridors.model.DoorSegment;
import features.world.dungeonmap.rooms.model.DungeonRoom;
import features.world.dungeonmap.rooms.model.DungeonRoomCluster;
import features.world.dungeonmap.view.model.DungeonRuntimeLocation;
import features.world.dungeonmap.foundation.geometry.Point2i;
import features.world.dungeonmap.canvas.rendering.DungeonCanvasCamera;
import features.world.dungeonmap.canvas.rendering.DungeonGridSurface;
import features.world.dungeonmap.canvas.rendering.DungeonLayoutRenderData;
import features.world.dungeonmap.editor.session.application.CorridorDoorHandle;
import features.world.dungeonmap.editor.workspace.ui.corridor.CorridorDoorHit;
import features.world.dungeonmap.editor.workspace.ui.corridor.DungeonCorridorProjectionSupport;
import features.world.dungeonmap.editor.workspace.ui.corridor.DungeonPaneCorridorWorkspace;
import features.world.dungeonmap.editor.workspace.ui.preview.DungeonPanePreviewModel;
import features.world.dungeonmap.editor.workspace.ui.base.input.DungeonPaneGraphCreationProjection;
import features.world.dungeonmap.editor.workspace.ui.base.input.DungeonPaneGridPointerProjection;
import features.world.dungeonmap.editor.workspace.ui.base.input.DungeonPanePointerProjection;
import features.world.dungeonmap.editor.workspace.ui.preview.DungeonPaneSelectionAreaProjection;
import features.world.dungeonmap.editor.workspace.ui.wallpath.DungeonPaneWallPathProjection;
import javafx.scene.canvas.GraphicsContext;
import javafx.scene.layout.StackPane;

import java.util.Objects;

public abstract class AbstractDungeonPane extends StackPane implements DungeonGridSurface, DungeonPanePointerProjection, DungeonPaneContext {

    protected final DungeonCanvasCamera camera;
    private final DungeonPaneSceneState sceneState = new DungeonPaneSceneState();
    private final DungeonPaneCanvasLifecycle canvasLifecycle;
    private DungeonPaneInteractionServices interactions;
    private DungeonPaneSelectionState selectionState;

    protected AbstractDungeonPane(DungeonCanvasCamera camera) {
        this.camera = Objects.requireNonNull(camera, "camera");
        this.canvasLifecycle = new DungeonPaneCanvasLifecycle(this, this::render);
    }

    protected final void initInteractions(
            DungeonPaneGridPointerProjection gridProjection,
            DungeonPaneGraphCreationProjection graphCreationProjection,
            DungeonPaneSelectionAreaProjection selectionAreaProjection,
            DungeonPaneWallPathProjection wallPathProjection
    ) {
        this.interactions = new DungeonPaneInteractionServices(
                this,
                this,
                canvasLifecycle.canvas(),
                gridProjection,
                graphCreationProjection,
                selectionAreaProjection,
                wallPathProjection);
        this.selectionState = new DungeonPaneSelectionState(
                () -> interactions.renderState().previewState().hoveredCorridorId());
    }

    public final void bindInteractionSink(DungeonPaneInteractionSink interactionSink) {
        interactions.bindInteractionSink(interactionSink);
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

    @Override
    public abstract DungeonRoomCluster findClusterAt(double screenX, double screenY);

    @Override
    public abstract DungeonRoom findRoomAt(double screenX, double screenY);

    public abstract DungeonCorridor findCorridorAt(double screenX, double screenY);

    public abstract CorridorDoorHit findCorridorDoorHitAt(double screenX, double screenY);

    public DungeonCorridorEndpoint corridorEndpointLocationAt(double screenX, double screenY, DungeonRoom room, DungeonCorridor corridor) {
        if (room != null && room.roomId() != null) {
            return DungeonCorridorEndpoint.room(room.roomId());
        }
        if (corridor != null && corridor.corridorId() != null) {
            return DungeonCorridorEndpoint.corridor(corridor.corridorId());
        }
        return null;
    }

    public abstract int corridorSegmentIndexAt(double screenX, double screenY);

    public abstract double corridorDoorHitDistance(
            double screenX,
            double screenY,
            DungeonCorridor corridor,
            CorridorGeometry geometry,
            DoorSegment door
    );

    public abstract double selectedCorridorDoorHandleDistance(
            double screenX,
            double screenY,
            DungeonCorridorProjectionSupport.CorridorSelectionContext context,
            DoorSegment door
    );

    public abstract double selectedCorridorWaypointHandleDistance(
            double screenX,
            double screenY,
            DungeonCorridorProjectionSupport.CorridorSelectionContext context,
            Point2i waypoint
    );

    protected final DungeonLayoutRenderData corridorRenderDataForDisplay() {
        return sceneState.renderData();
    }

    public abstract DungeonEditorSurface surface();

    public final void render() {
        canvasLifecycle.render(sceneState.layoutPresent(), this::renderContent);
    }

    public final boolean editable() {
        return interactions.renderState().editable();
    }

    public final DungeonEditorTool editorTool() {
        return interactions.renderState().editorTool();
    }

    public final void setLayoutState(
            DungeonViewState viewState,
            DungeonLayoutRenderData renderData
    ) {
        sceneState.setLayoutState(viewState, renderData);
        selectionState.setLayoutState(viewState, renderData);
    }

    @Override
    public final DungeonPaneSelectionState selectionState() {
        return selectionState;
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

    protected final DungeonPaneInteractionServices interactions() {
        return interactions;
    }

    public final DungeonPanePreviewModel previewModel() {
        return interactions.previewModel();
    }

    public final DungeonPaneCorridorWorkspace corridorWorkspace() {
        return interactions.corridorWorkspace();
    }

    @Override
    public final DungeonLayoutRenderData layoutRenderData() {
        return sceneState.renderData();
    }

    protected final javafx.scene.canvas.Canvas canvas() {
        return canvasLifecycle.canvas();
    }

    public final void rebuildClusterDragPreview() {
        DungeonPanePreviewModel previewModel = interactions.previewModel();
        if (sceneState.layout() == null || interactions.renderState().previewState().clusterCenters().isEmpty()) {
            interactions.renderState().previewTopologySession().reset();
            return;
        }
        previewModel.previewTopologySession().rebuild(
                sceneState.layout(),
                sceneState.renderData(),
                interactions.renderState().previewState().clusterCenters(),
                previewModel::previewCenter,
                previewModel::previewDelta);
    }

}
