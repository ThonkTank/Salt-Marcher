package features.world.dungeonmap.editor.workspace.ui.corridor;

import features.world.dungeonmap.editor.session.application.CorridorDoorHandle;
import features.world.dungeonmap.editor.session.application.CorridorWaypointHandle;
import features.world.dungeonmap.editor.workspace.ui.base.AbstractDungeonPane;
import features.world.dungeonmap.editor.workspace.ui.base.DungeonEditorTool;
import features.world.dungeonmap.editor.workspace.ui.base.DungeonPaneSceneState;
import features.world.dungeonmap.editor.workspace.ui.preview.DungeonPanePreviewModel;
import features.world.dungeonmap.editor.workspace.ui.preview.DungeonPaneRenderState;
import features.world.dungeonmap.layout.model.DungeonLayout;
import features.world.dungeonmap.corridors.model.CorridorGeometry;
import features.world.dungeonmap.corridors.model.DoorSegment;
import features.world.dungeonmap.corridors.model.DungeonCorridor;
import features.world.dungeonmap.rooms.model.DungeonRoom;
import features.world.dungeonmap.foundation.geometry.Point2i;
import features.world.dungeonmap.view.model.DungeonSelection;
import features.world.dungeonmap.canvas.rendering.DungeonCanvasCamera;
import features.world.dungeonmap.canvas.rendering.DungeonLayoutRenderData;
import javafx.scene.input.MouseEvent;

import java.util.Objects;
import java.util.Set;

public final class DungeonPaneCorridorWorkspace implements
        CorridorEditInteractionController.Host,
        DungeonPaneCorridorInteractionSupport.Host,
        DungeonCorridorProjectionSupport.Host {

    private final AbstractDungeonPane pane;
    private final DungeonPaneSceneState sceneState;
    private final DungeonPaneRenderState renderState;
    private final DungeonPanePreviewModel previewModel;
    private final DungeonPaneCorridorInteractionSupport corridorInteractionSupport;
    private final DungeonCorridorProjectionSupport corridorProjectionSupport;
    private final DungeonCorridorHitResolver hitResolver;
    private final DungeonCorridorDragPreviewManager dragPreviewManager;
    private CorridorEditInteractionController controller;

    public DungeonPaneCorridorWorkspace(
            AbstractDungeonPane pane,
            DungeonPaneSceneState sceneState,
            DungeonPaneRenderState renderState,
            DungeonPanePreviewModel previewModel
    ) {
        this.pane = Objects.requireNonNull(pane, "pane");
        this.sceneState = Objects.requireNonNull(sceneState, "sceneState");
        this.renderState = Objects.requireNonNull(renderState, "renderState");
        this.previewModel = Objects.requireNonNull(previewModel, "previewModel");
        this.corridorProjectionSupport = new DungeonCorridorProjectionSupport(this);
        this.corridorInteractionSupport = new DungeonPaneCorridorInteractionSupport(this);
        this.hitResolver = new DungeonCorridorHitResolver(pane, corridorInteractionSupport);
        this.dragPreviewManager = new DungeonCorridorDragPreviewManager(previewModel, renderState, corridorProjectionSupport);
    }

    // --- Coordination ---

    public void bindController(CorridorEditInteractionController corridorEditController) {
        this.controller = Objects.requireNonNull(corridorEditController, "corridorEditController");
    }

    public void applySelectedCorridorDoorHandle(
            CorridorDoorHandle handle,
            boolean renderNow,
            Runnable renderAction
    ) {
        CorridorDoorHandle normalizedHandle = corridorProjectionSupport.normalizeCorridorDoorHandle(handle);
        if (Objects.equals(renderState.previewState().selectedCorridorDoorHandle(), normalizedHandle)) {
            if (renderNow) {
                renderAction.run();
            }
            return;
        }
        renderState.previewState().setSelectedCorridorDoorHandle(normalizedHandle);
        if (renderNow) {
            renderAction.run();
        }
    }

    public CorridorEditInteractionController.PressMode corridorPressMode() {
        return requireController().previewPressMode();
    }

    public boolean updateCorridorPressMode(MouseEvent event) {
        return requireController().updatePreviewPressMode(event);
    }

    public void clearCorridorPressModePreview() {
        requireController().clearPreviewPressMode();
    }

    // --- Delegated to DungeonCorridorDragPreviewManager ---

    public CorridorEditInteractionController.DoorDragPreview corridorDoorPreview() {
        return dragPreviewManager.corridorDoorPreview();
    }

    public CorridorDoorHandle previewCorridorDoorHandle() {
        return dragPreviewManager.previewCorridorDoorHandle();
    }

    public boolean isPreviewDoor(long corridorId, long roomId) {
        return dragPreviewManager.isPreviewDoor(corridorId, roomId);
    }

    public boolean clearCorridorDoorPreview() {
        return dragPreviewManager.clearCorridorDoorPreview();
    }

    // --- Delegated to DungeonCorridorHitResolver ---

    public CorridorDoorHit findNearestCorridorDoorHit(double screenX, double screenY) {
        return hitResolver.findNearestCorridorDoorHit(screenX, screenY);
    }

    // --- Delegated to corridorInteractionSupport ---

    public CorridorDoorHit corridorDoorHit(DoorSegment door, Long fallbackCorridorId) {
        return corridorInteractionSupport.corridorDoorHit(door, fallbackCorridorId);
    }

    public CorridorGeometry corridorGeometryForSelection(DungeonCorridor corridor) {
        return corridorInteractionSupport.corridorGeometryForSelection(corridor);
    }

    public CorridorGeometry corridorGeometryForDisplay(DungeonCorridor corridor) {
        return corridorInteractionSupport.corridorGeometryForDisplay(corridor);
    }

    public boolean isSelected(CorridorDoorHandle handle) {
        return corridorInteractionSupport.isSelected(handle);
    }

    // --- Delegated to corridorProjectionSupport ---

    public DungeonCorridorProjectionSupport.CorridorSelectionContext selectedCorridorContext() {
        return corridorProjectionSupport.selectedCorridorContext();
    }

    public CorridorDoorHandle corridorDoorHandleForRoom(long roomId) {
        return corridorProjectionSupport.corridorDoorHandleForRoom(roomId);
    }

    public CorridorDoorHandle selectedCorridorDoorHandle() {
        return renderState.previewState().selectedCorridorDoorHandle();
    }

    // --- CorridorEditInteractionController.Host ---

    @Override
    public boolean editable() {
        return renderState.editable();
    }

    @Override
    public DungeonEditorTool editorTool() {
        return renderState.editorTool();
    }

    @Override
    public CorridorDoorHandle findCorridorDoorHandleAt(double screenX, double screenY) {
        return hitResolver.findCorridorDoorHandleAt(screenX, screenY);
    }

    @Override
    public CorridorEditInteractionController.DoorDragPreview corridorDoorDragPreviewAt(
            double screenX,
            double screenY,
            CorridorDoorHandle handle
    ) {
        return dragPreviewManager.corridorDoorDragPreviewAt(screenX, screenY, handle);
    }

    @Override
    public boolean updateCorridorDoorPreview(
            CorridorDoorHandle handle,
            CorridorEditInteractionController.DoorDragPreview preview
    ) {
        return dragPreviewManager.updateCorridorDoorPreview(handle, preview);
    }

    @Override
    public CorridorWaypointHandle findCorridorWaypointHandleAt(double screenX, double screenY) {
        return hitResolver.findCorridorWaypointHandleAt(screenX, screenY);
    }

    @Override
    public CorridorWaypointHandle findCorridorWaypointRemoveHandleAt(double screenX, double screenY) {
        return hitResolver.findCorridorWaypointRemoveHandleAt(screenX, screenY);
    }

    @Override
    public CorridorEditInteractionController.SegmentInsertHit findCorridorSegmentInsertHitAt(double screenX, double screenY) {
        return hitResolver.findCorridorSegmentInsertHitAt(screenX, screenY);
    }

    // --- DungeonPaneCorridorInteractionSupport.Host ---

    @Override
    public DungeonLayout dungeonLayout() {
        return pane.dungeonLayout();
    }

    @Override
    public DungeonLayoutRenderData renderData() {
        return sceneState.renderData();
    }

    @Override
    public features.world.dungeonmap.editor.workspace.ui.preview.DungeonPreviewState previewState() {
        return renderState.previewState();
    }

    @Override
    public features.world.dungeonmap.editor.workspace.ui.preview.DungeonPreviewTopologySession previewTopologySession() {
        return renderState.previewTopologySession();
    }

    @Override
    public boolean hasClusterDragPreview() {
        return previewModel.hasClusterDragPreview();
    }

    @Override
    public double selectedCorridorDoorHandleDistance(
            double screenX,
            double screenY,
            DungeonCorridorProjectionSupport.CorridorSelectionContext context,
            DoorSegment door
    ) {
        return hitResolver.selectedCorridorDoorHandleDistance(screenX, screenY, context, door);
    }

    @Override
    public double selectedCorridorWaypointHandleDistance(
            double screenX,
            double screenY,
            DungeonCorridorProjectionSupport.CorridorSelectionContext context,
            Point2i waypoint
    ) {
        return hitResolver.selectedCorridorWaypointHandleDistance(screenX, screenY, context, waypoint);
    }

    @Override
    public CorridorWaypointHandle waypointHandleForSegmentRemoval(
            DungeonCorridorProjectionSupport.CorridorSelectionContext context,
            double screenX,
            double screenY,
            int segmentIndex
    ) {
        return corridorProjectionSupport.waypointHandleForSegmentRemoval(context, screenX, screenY, segmentIndex);
    }

    @Override
    public int insertIndexForSegment(long corridorId, CorridorGeometry geometry, int segmentIndex) {
        return corridorProjectionSupport.insertIndexForSegment(corridorId, geometry, segmentIndex);
    }

    @Override
    public int corridorSegmentIndexAt(double screenX, double screenY) {
        return pane.corridorSegmentIndexAt(screenX, screenY);
    }

    @Override
    public Point2i worldPointAt(double screenX, double screenY) {
        return pane.worldPointAt(screenX, screenY);
    }

    @Override
    public double corridorDoorHitDistance(
            double screenX,
            double screenY,
            DungeonCorridor corridor,
            CorridorGeometry geometry,
            DoorSegment door
    ) {
        return hitResolver.corridorDoorHitDistance(screenX, screenY, corridor, geometry, door);
    }

    // --- DungeonCorridorProjectionSupport.Host ---

    @Override
    public DungeonSelection selectedTarget() {
        return sceneState.selectedTarget();
    }

    @Override
    public DungeonCanvasCamera camera() {
        return pane.camera();
    }

    @Override
    public Set<Point2i> roomCellsFor(DungeonRoom room) {
        return previewModel.roomCellsFor(room);
    }

    @Override
    public double distanceToRoomCell(double screenX, double screenY, Point2i roomCell) {
        return previewModel.distanceToRoomCell(screenX, screenY, roomCell);
    }

    private CorridorEditInteractionController requireController() {
        return Objects.requireNonNull(controller, "corridorController");
    }
}
