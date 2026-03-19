package features.world.quarantine.dungeonmap.editor.workspace.preview;

import features.world.quarantine.dungeonmap.editor.workspace.pane.AbstractDungeonPane;
import features.world.quarantine.dungeonmap.editor.workspace.DungeonViewMode;
import features.world.quarantine.dungeonmap.editor.workspace.DungeonEditorTool;
import features.world.quarantine.dungeonmap.editor.workspace.contract.DungeonPaneInteractionSink;
import features.world.quarantine.dungeonmap.editor.workspace.interaction.DungeonPaneInteractionState;
import features.world.quarantine.dungeonmap.editor.workspace.corridor.DungeonPaneCorridorWorkspace;
import features.world.quarantine.dungeonmap.layout.model.DungeonLayout;
import features.world.quarantine.dungeonmap.layout.model.DungeonSelection;
import features.world.quarantine.dungeonmap.corridors.model.DungeonCorridor;
import features.world.quarantine.dungeonmap.rooms.model.DungeonRoom;
import features.world.quarantine.dungeonmap.rooms.model.DungeonRoomCluster;
import features.world.quarantine.dungeonmap.foundation.geometry.Point2i;
import features.world.quarantine.dungeonmap.canvas.viewport.DungeonCanvasCamera;
import features.world.quarantine.dungeonmap.canvas.state.DungeonLayoutRenderData;
import features.world.quarantine.dungeonmap.foundation.geometry.ScreenPoint;

import java.util.Objects;
import java.util.Set;
import java.util.function.Supplier;

public final class DungeonPanePreviewModel implements
        DungeonPreviewInteractionHandler.Host,
        DungeonPreviewGeometryProjector.Host {

    private final AbstractDungeonPane pane;
    private final DungeonPaneRenderState renderState;
    private final DungeonPreviewInteractionHandler previewSupport;
    private final DungeonPreviewGeometryProjector previewGeometrySupport;
    private final Supplier<DungeonPaneInteractionSink> interactionSinkSupplier;
    private DungeonPaneCorridorWorkspace corridorWorkspace;

    public DungeonPanePreviewModel(
            AbstractDungeonPane pane,
            DungeonPaneRenderState renderState,
            DungeonPaneSelectionAreaProjection selectionAreaProjection,
            Supplier<DungeonPaneInteractionSink> interactionSinkSupplier
    ) {
        this.pane = Objects.requireNonNull(pane, "pane");
        this.renderState = Objects.requireNonNull(renderState, "renderState");
        this.interactionSinkSupplier = Objects.requireNonNull(interactionSinkSupplier, "interactionSinkSupplier");
        this.previewSupport = new DungeonPreviewInteractionHandler(this, Objects.requireNonNull(selectionAreaProjection, "selectionAreaProjection"));
        this.previewGeometrySupport = new DungeonPreviewGeometryProjector(this);
    }

    /** Phase-2 init: injects the corridor workspace after both objects are constructed. */
    public void initCorridorWorkspace(DungeonPaneCorridorWorkspace corridorWorkspace) {
        this.corridorWorkspace = Objects.requireNonNull(corridorWorkspace, "corridorWorkspace");
    }

    public DungeonPreviewGeometryProjector geometry() { return previewGeometrySupport; }
    public DungeonPreviewInteractionHandler preview() { return previewSupport; }
    public DungeonPaneRenderState renderState() { return renderState; }

    public Set<Point2i> previewPaintCells() { return renderState.previewState().paintCells(); }
    public Point2i selectionStartCell() {
        var pi = renderState.interactionState().pointerInteraction();
        return pi instanceof DungeonPaneInteractionState.SelectionInteraction s ? s.anchorWorld() : null;
    }
    public Point2i selectionEndCell() {
        var pi = renderState.interactionState().pointerInteraction();
        return pi instanceof DungeonPaneInteractionState.SelectionInteraction s ? s.endWorld() : null;
    }
    public boolean hasClusterDragPreview() { return !renderState.previewState().clusterCenters().isEmpty(); }

    @Override
    public DungeonEditorTool editorTool() {
        return renderState.editorTool();
    }

    @Override
    public DungeonViewMode viewMode() {
        return pane.viewMode();
    }

    @Override
    public boolean layoutPresent() {
        return pane.layoutPresent();
    }

    @Override
    public void clearCorridorPressModePreview() {
        requireCorridorWorkspace().clearCorridorPressModePreview();
    }

    @Override
    public boolean clearCorridorDoorPreview() {
        return requireCorridorWorkspace().clearCorridorDoorPreview();
    }

    @Override
    public void onClusterSelected(DungeonRoomCluster cluster) {
        interactionSinkSupplier.get().onClusterSelected(cluster);
    }

    @Override
    public void onRoomCellsPainted(Set<Point2i> cells) {
        interactionSinkSupplier.get().onRoomCellsPainted(cells);
    }

    @Override
    public void onRoomCellsDeleted(Set<Point2i> cells) {
        interactionSinkSupplier.get().onRoomCellsDeleted(cells);
    }

    @Override
    public void onClusterMoved(DungeonRoomCluster cluster, Point2i center) {
        interactionSinkSupplier.get().onClusterMoved(cluster, center);
    }

    @Override
    public void rebuildClusterDragPreview() {
        rebuildClusterDragPreview(pane.dungeonLayout(), pane.sceneState().renderData());
    }

    public void rebuildClusterDragPreview(DungeonLayout layout, DungeonLayoutRenderData renderData) {
        if (layout == null || renderState.previewState().clusterCenters().isEmpty()) {
            renderState.previewTopologySession().reset();
            return;
        }
        renderState.previewTopologySession().rebuild(
                layout,
                renderData,
                renderState.previewState().clusterCenters(),
                previewGeometrySupport::previewCenter,
                previewGeometrySupport::previewDelta);
    }

    @Override
    public void render() {
        pane.render();
    }

    @Override
    public double worldX(double screenX) {
        return pane.worldX(screenX);
    }

    @Override
    public double worldY(double screenY) {
        return pane.worldY(screenY);
    }

    @Override
    public DungeonRoomCluster findClusterAt(ScreenPoint screen) {
        return pane.hitTestDelegate().findClusterAt(screen);
    }

    @Override
    public DungeonRoom findRoomAt(ScreenPoint screen) {
        return pane.hitTestDelegate().findRoomAt(screen);
    }

    @Override
    public DungeonCorridor findCorridorAt(ScreenPoint screen) {
        return pane.hitTestDelegate().findCorridorAt(screen);
    }

    @Override
    public DungeonLayout dungeonLayout() {
        return pane.dungeonLayout();
    }

    @Override
    public DungeonLayoutRenderData renderData() {
        return pane.sceneState().renderData();
    }

    @Override
    public DungeonCanvasCamera camera() {
        return pane.camera();
    }

    @Override
    public DungeonSelection selectedTarget() {
        return pane.sceneState().selectedTarget();
    }

    @Override
    public features.world.quarantine.dungeonmap.editor.workspace.pane.DungeonPaneSceneState sceneState() {
        return pane.sceneState();
    }

    // --- DungeonPreviewInteractionHandler.Host / DungeonPreviewGeometryProjector.Host ---

    @Override
    public DungeonPaneInteractionState interactionState() { return renderState.interactionState(); }

    @Override
    public double lastPointerScreenX() { return renderState.lastPointerScreenX(); }

    @Override
    public double lastPointerScreenY() { return renderState.lastPointerScreenY(); }

    @Override
    public boolean pointerInsideCanvas() { return renderState.pointerInsideCanvas(); }

    @Override
    public void updateTrackerPosition(double x, double y) { renderState.updateTrackerPosition(x, y); }

    @Override
    public void clearTrackerState() { renderState.clearTrackerState(); }

    @Override
    public DungeonPreviewState previewState() { return renderState.previewState(); }

    @Override
    public DungeonPreviewTopologySession previewTopologySession() { return renderState.previewTopologySession(); }

    private DungeonPaneCorridorWorkspace requireCorridorWorkspace() {
        if (corridorWorkspace == null) throw new IllegalStateException("initCorridorWorkspace() not called");
        return corridorWorkspace;
    }
}
