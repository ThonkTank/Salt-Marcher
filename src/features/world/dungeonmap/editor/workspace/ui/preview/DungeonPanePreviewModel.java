package features.world.dungeonmap.editor.workspace.ui.preview;

import features.world.dungeonmap.editor.workspace.ui.base.AbstractDungeonPane;
import features.world.dungeonmap.editor.workspace.ui.base.DungeonEditorSurface;
import features.world.dungeonmap.editor.workspace.ui.base.DungeonEditorTool;
import features.world.dungeonmap.editor.workspace.ui.base.DungeonPaneInteractionSink;
import features.world.dungeonmap.editor.workspace.ui.base.input.DungeonPaneInteractionState;
import features.world.dungeonmap.editor.workspace.ui.base.input.DungeonPanePointerTracker;
import features.world.dungeonmap.editor.workspace.ui.corridor.DungeonPaneCorridorWorkspace;
import features.world.dungeonmap.layout.model.DungeonLayout;
import features.world.dungeonmap.view.model.DungeonSelection;
import features.world.dungeonmap.corridors.model.CorridorGeometry;
import features.world.dungeonmap.corridors.model.DoorSegment;
import features.world.dungeonmap.corridors.model.DungeonCorridor;
import features.world.dungeonmap.rooms.model.DungeonRoom;
import features.world.dungeonmap.rooms.model.DungeonRoomCluster;
import features.world.dungeonmap.foundation.geometry.Point2i;
import features.world.dungeonmap.canvas.rendering.DungeonCanvasCamera;
import features.world.dungeonmap.canvas.rendering.DungeonLayoutRenderData;
import javafx.geometry.Point2D;
import javafx.scene.canvas.GraphicsContext;
import javafx.scene.input.MouseEvent;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

public final class DungeonPanePreviewModel implements
        DungeonPanePreviewSupport.Host,
        DungeonPanePreviewGeometrySupport.Host {

    private final AbstractDungeonPane pane;
    private final DungeonPaneRenderState renderState;
    private final DungeonPanePreviewSupport previewSupport;
    private final DungeonPanePreviewGeometrySupport previewGeometrySupport;
    private DungeonPaneInteractionSink interactionSink = DungeonPaneInteractionSink.NO_OP;
    private DungeonPaneCorridorWorkspace corridorWorkspace;

    public DungeonPanePreviewModel(
            AbstractDungeonPane pane,
            DungeonPaneRenderState renderState,
            DungeonPaneSelectionAreaProjection selectionAreaProjection
    ) {
        this.pane = Objects.requireNonNull(pane, "pane");
        this.renderState = Objects.requireNonNull(renderState, "renderState");
        this.previewSupport = new DungeonPanePreviewSupport(this, Objects.requireNonNull(selectionAreaProjection, "selectionAreaProjection"));
        this.previewGeometrySupport = new DungeonPanePreviewGeometrySupport(this);
    }

    public void bindInteractionSink(DungeonPaneInteractionSink interactionSink) {
        this.interactionSink = Objects.requireNonNull(interactionSink, "interactionSink");
    }

    public void bindCorridorWorkspace(DungeonPaneCorridorWorkspace corridorWorkspace) {
        this.corridorWorkspace = Objects.requireNonNull(corridorWorkspace, "corridorWorkspace");
    }

    public Point2i previewCenter(DungeonRoom room) { return previewGeometrySupport.previewCenter(room); }
    public Point2i previewCenter(DungeonRoomCluster cluster) { return previewGeometrySupport.previewCenter(cluster); }
    public Point2i previewClusterCell(DungeonRoomCluster cluster, Point2i relativeCell) { return previewGeometrySupport.previewClusterCell(cluster, relativeCell); }
    public Point2D previewOffset(Long clusterId) { return previewGeometrySupport.previewOffset(clusterId); }
    public Map<Long, Point2i> previewClusterCenters() { return previewGeometrySupport.previewClusterCenters(); }
    public Set<Point2i> previewPaintCells() { return renderState.previewState().paintCells(); }
    public Point2i selectionStartCell() {
        var pi = renderState.interactionState().pointerInteraction();
        return pi instanceof DungeonPaneInteractionState.SelectionInteraction s ? s.anchorWorld() : null;
    }
    public Point2i selectionEndCell() {
        var pi = renderState.interactionState().pointerInteraction();
        return pi instanceof DungeonPaneInteractionState.SelectionInteraction s ? s.endWorld() : null;
    }
    public double previewScreenX(double worldX, Long clusterId) { return previewGeometrySupport.previewScreenX(worldX, clusterId); }
    public double previewScreenY(double worldY, Long clusterId) { return previewGeometrySupport.previewScreenY(worldY, clusterId); }
    public double previewScreenX(double worldX, Point2D offset) { return previewGeometrySupport.previewScreenX(worldX, offset); }
    public double previewScreenY(double worldY, Point2D offset) { return previewGeometrySupport.previewScreenY(worldY, offset); }
    public Point2D corridorPreviewOffset(DungeonCorridor corridor) { return previewGeometrySupport.corridorPreviewOffset(corridor); }
    public Point2D doorPreviewOffset(DoorSegment door) { return previewGeometrySupport.doorPreviewOffset(door); }
    public boolean hasSmoothClusterDragPreview() { return previewGeometrySupport.hasSmoothClusterDragPreview(); }
    public boolean hasClusterDragPreview() { return !renderState.previewState().clusterCenters().isEmpty(); }
    public Set<Point2i> roomCellsFor(DungeonRoom room) { return previewGeometrySupport.roomCellsFor(room); }
    public List<List<Point2i>> roomLoopsFor(DungeonRoom room) { return previewGeometrySupport.roomLoopsFor(room); }
    public Set<Point2i> clusterCellsFor(DungeonRoomCluster cluster) { return previewGeometrySupport.clusterCellsFor(cluster); }
    public List<List<Point2i>> clusterLoopsFor(DungeonRoomCluster cluster) { return previewGeometrySupport.clusterLoopsFor(cluster); }
    public Point2i previewDelta(Long clusterId) { return previewGeometrySupport.previewDelta(clusterId); }
    public DungeonRoom previewRoomAtCell(Point2i cell) { return previewGeometrySupport.previewRoomAtCell(cell); }
    public DungeonRoomCluster previewClusterAtCell(Point2i cell) { return previewGeometrySupport.previewClusterAtCell(cell); }
    public boolean sameDoorSegment(DoorSegment left, DoorSegment right) { return previewGeometrySupport.sameDoorSegment(left, right); }
    public double distanceToDoor(double screenX, double screenY, DoorSegment door) { return previewGeometrySupport.distanceToDoor(screenX, screenY, door); }
    public double distanceToSegment(double screenX, double screenY, Point2i from, Point2i to) { return previewGeometrySupport.distanceToSegment(screenX, screenY, from, to); }
    public double distanceToRoomCell(double screenX, double screenY, Point2i roomCell) { return previewGeometrySupport.distanceToRoomCell(screenX, screenY, roomCell); }
    public double distanceToInvalidCorridorLink(double screenX, double screenY, CorridorGeometry geometry) { return previewGeometrySupport.distanceToInvalidCorridorLink(screenX, screenY, geometry); }
    public void strokeInvalidCorridorLink(GraphicsContext gc, CorridorGeometry geometry) { previewGeometrySupport.strokeInvalidCorridorLink(gc, geometry); }
    public boolean hasInvalidCorridorLink(CorridorGeometry geometry) { return previewGeometrySupport.hasInvalidCorridorLink(geometry); }
    public void clearSelectionPreview() { previewSupport.clearSelectionPreview(); }
    public void clearPaintPreview() { previewSupport.clearPaintPreview(); }
    public void rebuildPaintPreviewCells() { previewSupport.rebuildPaintPreviewCells(); }
    public void beginSelection(Point2i world) { previewSupport.beginSelection(world); }
    public void updateSelectionPreview(Point2i world) { previewSupport.updateSelectionPreview(world); }
    public void commitSelection(Point2i start, Point2i end) { previewSupport.commitSelection(start, end); }
    public void beginPaint(Point2i world) { previewSupport.beginPaint(world); }
    public void updatePaintPreview(Point2i world) { previewSupport.updatePaintPreview(world); }
    public void commitPaint(Point2i world) { previewSupport.commitPaint(world); }
    public void updateDragPreview(DungeonPaneInteractionState.DragInteraction dragInteraction) { previewSupport.updateDragPreview(dragInteraction); }
    public void commitDrag(DungeonPaneInteractionState.DragInteraction dragInteraction) { previewSupport.commitDrag(dragInteraction); }
    public void updatePointerPosition(MouseEvent event) { previewSupport.updatePointerPosition(event); }
    public boolean updateHoveredCorridorAt(double screenX, double screenY) { return previewSupport.updateHoveredCorridorAt(screenX, screenY); }
    public void refreshHoverAfterProjectionChange() { previewSupport.refreshHoverAfterProjectionChange(); }
    public void onPointerExited() { previewSupport.onPointerExited(); }
    public boolean clearHoveredCorridor() { return previewSupport.clearHoveredCorridor(); }
    public DungeonPreviewState previewState() { return renderState.previewState(); }
    public DungeonPreviewTopologySession previewTopologySession() { return renderState.previewTopologySession(); }
    public DungeonPaneInteractionState interactionState() { return renderState.interactionState(); }
    public DungeonPanePointerTracker pointerTracker() { return renderState.pointerTracker(); }

    @Override
    public DungeonEditorTool editorTool() {
        return renderState.editorTool();
    }

    @Override
    public DungeonEditorSurface surface() {
        return pane.surface();
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
        interactionSink.onClusterSelected(cluster);
    }

    @Override
    public void onRoomCellsPainted(Set<Point2i> cells) {
        interactionSink.onRoomCellsPainted(cells);
    }

    @Override
    public void onRoomCellsDeleted(Set<Point2i> cells) {
        interactionSink.onRoomCellsDeleted(cells);
    }

    @Override
    public void onClusterMoved(DungeonRoomCluster cluster, Point2i center) {
        interactionSink.onClusterMoved(cluster, center);
    }

    @Override
    public void rebuildClusterDragPreview() {
        pane.rebuildClusterDragPreview();
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
    public DungeonRoomCluster findClusterAt(double screenX, double screenY) {
        return pane.findClusterAt(screenX, screenY);
    }

    @Override
    public DungeonRoom findRoomAt(double screenX, double screenY) {
        return pane.findRoomAt(screenX, screenY);
    }

    @Override
    public DungeonCorridor findCorridorAt(double screenX, double screenY) {
        return pane.findCorridorAt(screenX, screenY);
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

    private DungeonPaneCorridorWorkspace requireCorridorWorkspace() {
        return Objects.requireNonNull(corridorWorkspace, "corridorWorkspace");
    }
}
