package features.world.dungeonmap.ui.workspace.workflow;

import features.world.dungeonmap.model.DungeonCorridor;
import features.world.dungeonmap.model.DungeonCorridorEndpoint;
import features.world.dungeonmap.model.DungeonRoom;
import features.world.dungeonmap.model.DungeonRoomCluster;
import features.world.dungeonmap.model.Point2i;
import features.world.dungeonmap.ui.workspace.DungeonEditorTool;
import features.world.dungeonmap.ui.workspace.render.CorridorDoorHit;
import features.world.dungeonmap.ui.workspace.workflow.state.DungeonPaneInteractionState;
import javafx.geometry.Point2D;
import javafx.scene.input.KeyEvent;
import javafx.scene.input.MouseButton;
import javafx.scene.input.MouseEvent;
import javafx.scene.input.ScrollEvent;

public final class DungeonPaneWorkflowCoordinator {

    private final DungeonPaneWorkflowHost host;

    public DungeonPaneWorkflowCoordinator(DungeonPaneWorkflowHost host) {
        this.host = host;
        host.controller().setOnCorridorDoorSelected(handle -> {
            host.applySelectedCorridorDoorHandle(handle, true, true);
            host.callbacks().onCorridorDoorSelectionChanged().accept(host.selectedCorridorDoorHandle());
        });
    }

    public void setEditorTool(DungeonEditorTool editorTool) {
        host.setEditorToolInternal(editorTool == null ? DungeonEditorTool.SELECT : editorTool);
        host.previewPaintCells().clear();
        host.clearSelectionPreview();
        host.clearPaintPreview();
        host.wallPathController().reset();
        host.controller().cancel();
        host.clearCorridorDoorPreview();
        host.clearHoveredCorridor();
        if (host.editorTool() != DungeonEditorTool.SELECT) {
            host.applySelectedCorridorDoorHandle(null, false, false);
        } else {
            host.applySelectedCorridorDoorHandle(host.selectedCorridorDoorHandle(), false, false);
        }
        host.requestRender();
    }

    public void showLayout(
            features.world.dungeonmap.model.DungeonLayout layout,
            features.world.dungeonmap.ui.workspace.render.DungeonLayoutRenderData renderData,
            features.world.dungeonmap.model.DungeonSelection selectedTarget,
            features.world.dungeonmap.model.DungeonRuntimeLocation activeLocation,
            boolean renderNow
    ) {
        host.setLayoutState(layout, renderData, selectedTarget, activeLocation);
        host.previewTopologySession().reset();
        host.previewState().clearTransientPreview();
        host.clearSelectionPreview();
        host.clearPaintPreview();
        host.wallPathController().reset();
        host.controller().cancel();
        host.clearCorridorDoorPreview();
        host.clearHoveredCorridor();
        host.applySelectedCorridorDoorHandle(host.selectedCorridorDoorHandle(), false, false);
        if (renderNow) {
            host.requestRender();
        }
    }

    public void updateSelection(
            features.world.dungeonmap.model.DungeonSelection selectedTarget,
            features.world.dungeonmap.model.DungeonRuntimeLocation activeLocation,
            boolean renderNow
    ) {
        host.setLayoutState(host.dungeonLayout(), host.renderData(), selectedTarget, activeLocation);
        host.clearCorridorDoorPreview();
        host.clearHoveredCorridor();
        host.applySelectedCorridorDoorHandle(host.selectedCorridorDoorHandle(), false, false);
        if (renderNow) {
            host.requestRender();
        }
    }

    public void refreshViewport() {
        host.requestRender();
    }

    public void setSelectedCorridorDoorHandle(CorridorEditInteractionController.DoorHandle handle) {
        host.applySelectedCorridorDoorHandle(handle, false, true);
    }

    public CorridorEditInteractionController.DoorHandle selectedCorridorDoorHandle() {
        return host.selectedCorridorDoorHandle();
    }

    public void handleMousePressed(MouseEvent event) {
        if (host.dungeonLayout() == null) {
            return;
        }
        if (handlePanPress(event)) {
            return;
        }
        CorridorEditInteractionController.PressHit corridorPressHit = host.controller().hitTest(event);
        if (host.controller().handlePress(corridorPressHit)) {
            return;
        }
        PointerContext context = pointerContext(event);
        if (handleRoomToolPress(event, context)) {
            return;
        }
        if (handleCorridorToolPress(event, context)) {
            return;
        }
        if (handleRoomDragPress(event, context)) {
            return;
        }
        if (handleSelectionPress(event, context)) {
            return;
        }
        if (context.corridor() != null) {
            host.callbacks().onCorridorSelected().accept(context.corridor());
            return;
        }
        if (context.cluster() != null) {
            host.callbacks().onClusterSelected().accept(context.cluster());
            return;
        }
        if (context.room() != null) {
            host.callbacks().onRoomSelected().accept(context.room());
            return;
        }
        host.interactionState().setPointerInteraction(DungeonPaneInteractionState.IdleInteraction.INSTANCE);
    }

    public void handleMouseMoved(MouseEvent event) {
        host.updatePointerPosition(event);
        boolean corridorPreviewChanged = host.updateCorridorPressMode(event) | host.updateHoveredCorridorAt(event.getX(), event.getY());
        if (corridorPreviewChanged) {
            host.requestRender();
        }
        host.wallPathController().handlePointerMove(event.getX(), event.getY());
    }

    public void handleMouseDragged(MouseEvent event) {
        host.updatePointerPosition(event);
        boolean corridorPreviewChanged = host.updateCorridorPressMode(event) | host.updateHoveredCorridorAt(event.getX(), event.getY());
        if (corridorPreviewChanged) {
            host.requestRender();
        }
        if (host.interactionState().pointerInteraction() instanceof DungeonPaneInteractionState.PanInteraction) {
            host.callbacks().onViewportPanned().accept(new Point2D(event.getX(), event.getY()));
            host.refreshHoverAfterProjectionChange();
            return;
        }
        if (host.controller().handleDrag(event)) {
            host.requestRender();
            return;
        }
        host.wallPathController().handlePointerMove(event.getX(), event.getY());
        Point2i world = host.worldPointAt(event.getX(), event.getY());
        if (!host.editable() || !(host.interactionState().pointerInteraction() instanceof DungeonPaneInteractionState.DragInteraction dragInteraction)) {
            handlePreviewDrag(world);
            return;
        }
        host.updateDragPreview(dragInteraction, world);
    }

    public void handleMouseReleased(MouseEvent event) {
        if (host.updateCorridorPressMode(event)) {
            host.requestRender();
        }
        if (host.interactionState().pointerInteraction() instanceof DungeonPaneInteractionState.PanInteraction) {
            host.interactionState().setPointerInteraction(DungeonPaneInteractionState.IdleInteraction.INSTANCE);
            return;
        }
        Point2i world = host.worldPointAt(event.getX(), event.getY());
        if (handleEditableRelease(world)) {
            return;
        }
        handleDragRelease(event, world);
    }

    public void handleScroll(ScrollEvent event) {
        host.interactionState().setPointerInsideCanvas(true);
        host.interactionState().setLastPointerScreenX(event.getX());
        host.interactionState().setLastPointerScreenY(event.getY());
        double factor = event.getDeltaY() > 0 ? 1.1 : 0.9;
        host.callbacks().onViewportZoomed().handle(event.getX(), event.getY(), factor);
        host.refreshHoverAfterProjectionChange();
    }

    public void handleKeyPressed(KeyEvent event) {
        host.wallPathController().handleKeyPressed(event);
    }

    public void handlePointerExited() {
        host.onPointerExited();
    }

    private boolean handlePanPress(MouseEvent event) {
        if (host.updateCorridorPressMode(event)) {
            host.requestRender();
        }
        if (event.getButton() == MouseButton.SECONDARY && host.wallPathController().handleSecondaryPress()) {
            host.requestRender();
            return true;
        }
        if (event.getButton() != MouseButton.SECONDARY) {
            return false;
        }
        host.interactionState().setPointerInteraction(new DungeonPaneInteractionState.PanInteraction());
        host.callbacks().onViewportPanStarted().accept(new Point2D(event.getX(), event.getY()));
        return true;
    }

    private PointerContext pointerContext(MouseEvent event) {
        return new PointerContext(
                host.worldPointAt(event.getX(), event.getY()),
                host.findClusterAt(event.getX(), event.getY()),
                host.findRoomAt(event.getX(), event.getY()),
                host.findCorridorAt(event.getX(), event.getY()),
                host.findCorridorDoorHitAt(event.getX(), event.getY()));
    }

    private boolean handleRoomToolPress(MouseEvent event, PointerContext context) {
        if (!host.editable() || event.getButton() != MouseButton.PRIMARY) {
            return false;
        }
        if ((host.editorTool().isWallTool() || host.editorTool().isDoorTool())
                && host.surface() == DungeonEditorSurface.GRID) {
            var edgeRef = host.findClusterEdgeAt(event.getX(), event.getY());
            if (edgeRef == null) {
                return false;
            }
            if (host.editorTool().isWallTool()) {
                host.wallPathController().handlePrimaryPress(event.getX(), event.getY());
            } else if (host.editorTool() == DungeonEditorTool.CLUSTER_DOOR_DELETE) {
                host.callbacks().onClusterDoorDeleted().accept(java.util.Set.of(edgeRef));
            } else {
                host.callbacks().onClusterDoorPainted().accept(java.util.Set.of(edgeRef));
            }
            return true;
        }
        if (host.editorTool() != DungeonEditorTool.ROOM_PAINT && host.editorTool() != DungeonEditorTool.ROOM_DELETE) {
            return false;
        }
        if (host.surface() == DungeonEditorSurface.GRID) {
            host.beginPaint(context.world());
            host.interactionState().setPointerInteraction(new DungeonPaneInteractionState.PaintInteraction());
            return true;
        }
        if (host.surface() != DungeonEditorSurface.GRAPH) {
            return false;
        }
        if (host.editorTool() == DungeonEditorTool.ROOM_PAINT
                && context.cluster() == null
                && context.room() == null
                && host.canCreateGraphRoomAt(context.world())) {
            host.interactionState().setPointerInteraction(new DungeonPaneInteractionState.GraphCreateInteraction(context.world()));
            return true;
        }
        if (host.editorTool() == DungeonEditorTool.ROOM_DELETE && context.cluster() != null) {
            host.interactionState().setPointerInteraction(new DungeonPaneInteractionState.GraphDeleteInteraction(context.cluster()));
            return true;
        }
        return false;
    }

    private boolean handleCorridorToolPress(MouseEvent event, PointerContext context) {
        if (!host.editable() || event.getButton() != MouseButton.PRIMARY) {
            return false;
        }
        if (host.editorTool() != DungeonEditorTool.CORRIDOR_CREATE && host.editorTool() != DungeonEditorTool.CORRIDOR_DELETE) {
            return false;
        }
        if (host.editorTool() == DungeonEditorTool.CORRIDOR_CREATE) {
            DungeonCorridorEndpoint endpoint = host.corridorEndpointLocationAt(event.getX(), event.getY(), context.room(), context.corridor());
            if (endpoint != null) {
                host.callbacks().onCorridorEndpointSelected().accept(endpoint);
                return true;
            }
            if (context.corridor() != null) {
                host.callbacks().onCorridorEndpointSelected().accept(DungeonCorridorEndpoint.corridor(context.corridor().corridorId()));
                return true;
            }
            return false;
        }
        if (context.corridorDoorHit() != null) {
            host.callbacks().onCorridorRoomRemoved().accept(context.corridorDoorHit());
            return true;
        }
        if (context.corridor() != null) {
            host.callbacks().onCorridorDeleted().accept(context.corridor());
            return true;
        }
        return false;
    }

    private boolean handleRoomDragPress(MouseEvent event, PointerContext context) {
        if (!(host.editable() && context.cluster() != null && isRoomDragButton(event.getButton(), host.editorTool()))) {
            return false;
        }
        host.callbacks().onClusterSelected().accept(context.cluster());
        host.interactionState().setPointerInteraction(new DungeonPaneInteractionState.DragInteraction(
                context.cluster(),
                context.cluster().center(),
                host.worldX(event.getX()),
                host.worldY(event.getY())));
        return true;
    }

    private boolean handleSelectionPress(MouseEvent event, PointerContext context) {
        if (!(host.editable()
                && event.getButton() == MouseButton.PRIMARY
                && host.editorTool() == DungeonEditorTool.SELECT
                && host.surface() == DungeonEditorSurface.GRID
                && context.corridor() == null
                && context.cluster() == null
                && context.room() == null)) {
            return false;
        }
        host.beginSelection(context.world());
        host.interactionState().setPointerInteraction(new DungeonPaneInteractionState.SelectionInteraction(context.world()));
        return true;
    }

    private void handlePreviewDrag(Point2i world) {
        if (host.editable() && host.interactionState().pointerInteraction() instanceof DungeonPaneInteractionState.PaintInteraction) {
            host.updatePaintPreview(world);
        }
        if (host.editable() && host.interactionState().pointerInteraction() instanceof DungeonPaneInteractionState.SelectionInteraction) {
            host.updateSelectionPreview(world);
        }
    }

    private boolean handleEditableRelease(Point2i world) {
        if (host.editable() && host.interactionState().pointerInteraction() instanceof DungeonPaneInteractionState.SelectionInteraction selectionInteraction) {
            host.interactionState().setPointerInteraction(DungeonPaneInteractionState.IdleInteraction.INSTANCE);
            host.commitSelection(selectionInteraction.anchorWorld(), world);
            return true;
        }
        if (host.editable() && host.interactionState().pointerInteraction() instanceof DungeonPaneInteractionState.PaintInteraction) {
            host.interactionState().setPointerInteraction(DungeonPaneInteractionState.IdleInteraction.INSTANCE);
            host.commitPaint(world);
            return true;
        }
        if (host.editable() && host.interactionState().pointerInteraction() instanceof DungeonPaneInteractionState.GraphCreateInteraction graphCreateInteraction) {
            host.interactionState().setPointerInteraction(DungeonPaneInteractionState.IdleInteraction.INSTANCE);
            host.callbacks().onGraphRoomRequested().accept(graphCreateInteraction.world());
            return true;
        }
        if (host.editable() && host.interactionState().pointerInteraction() instanceof DungeonPaneInteractionState.GraphDeleteInteraction graphDeleteInteraction) {
            host.interactionState().setPointerInteraction(DungeonPaneInteractionState.IdleInteraction.INSTANCE);
            host.callbacks().onGraphClusterDeleted().accept(graphDeleteInteraction.cluster());
            return true;
        }
        if (host.controller().handleEditableRelease(world)) {
            host.interactionState().setPointerInteraction(DungeonPaneInteractionState.IdleInteraction.INSTANCE);
            return true;
        }
        return false;
    }

    private void handleDragRelease(MouseEvent event, Point2i world) {
        if (!host.editable()) {
            host.clearCorridorDoorPreview();
            host.interactionState().setPointerInteraction(DungeonPaneInteractionState.IdleInteraction.INSTANCE);
            return;
        }
        if (host.interactionState().pointerInteraction() instanceof DungeonPaneInteractionState.DragInteraction dragInteraction) {
            host.interactionState().setPointerInteraction(DungeonPaneInteractionState.IdleInteraction.INSTANCE);
            host.commitDrag(dragInteraction, world);
            return;
        }
        if (host.controller().handleDragRelease(event)) {
            host.interactionState().setPointerInteraction(DungeonPaneInteractionState.IdleInteraction.INSTANCE);
            host.requestRender();
            return;
        }
        host.interactionState().setPointerInteraction(DungeonPaneInteractionState.IdleInteraction.INSTANCE);
    }

    private static boolean isRoomDragButton(MouseButton button, DungeonEditorTool tool) {
        if (button == MouseButton.MIDDLE) {
            return true;
        }
        return button == MouseButton.PRIMARY && tool == DungeonEditorTool.SELECT;
    }

    private record PointerContext(
            Point2i world,
            DungeonRoomCluster cluster,
            DungeonRoom room,
            DungeonCorridor corridor,
            CorridorDoorHit corridorDoorHit
    ) {
    }
}
