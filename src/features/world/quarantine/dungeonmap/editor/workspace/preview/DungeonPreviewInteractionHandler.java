package features.world.quarantine.dungeonmap.editor.workspace.preview;

import features.world.quarantine.dungeonmap.editor.workspace.DungeonEditorTool;
import features.world.quarantine.dungeonmap.editor.workspace.DungeonViewMode;
import features.world.quarantine.dungeonmap.editor.workspace.DungeonPaneContext;
import features.world.quarantine.dungeonmap.editor.workspace.interaction.DungeonPaneInteractionState;
import features.world.quarantine.dungeonmap.rooms.model.DungeonRoomCluster;
import features.world.quarantine.dungeonmap.foundation.geometry.Point2i;
import javafx.geometry.Point2D;
import javafx.scene.input.MouseEvent;

import java.util.Objects;
import java.util.Set;

public final class DungeonPreviewInteractionHandler {

    private final Host host;
    private final DungeonPaneSelectionAreaProjection selectionAreaProjection;

    public DungeonPreviewInteractionHandler(Host host, DungeonPaneSelectionAreaProjection selectionAreaProjection) {
        this.host = Objects.requireNonNull(host, "host");
        this.selectionAreaProjection = Objects.requireNonNull(selectionAreaProjection, "selectionAreaProjection");
    }

    public void clearSelectionPreview() {
        host.clearCorridorPressModePreview();
        host.clearCorridorDoorPreview();
    }

    public void clearPaintPreview() {
        host.previewState().paintCells().clear();
    }

    public void rebuildPaintPreviewCells() {
        host.previewState().paintCells().clear();
        if (!(host.interactionState().pointerInteraction() instanceof DungeonPaneInteractionState.PaintInteraction state)) {
            return;
        }
        if (state.startCell() == null || state.endCell() == null) {
            return;
        }
        int minX = Math.min(state.startCell().x(), state.endCell().x());
        int maxX = Math.max(state.startCell().x(), state.endCell().x());
        int minY = Math.min(state.startCell().y(), state.endCell().y());
        int maxY = Math.max(state.startCell().y(), state.endCell().y());
        for (int x = minX; x <= maxX; x++) {
            for (int y = minY; y <= maxY; y++) {
                host.previewState().paintCells().add(new Point2i(x, y));
            }
        }
    }

    public void beginSelection(Point2i world) {
        // SelectionInteraction(world) was already set with anchorWorld=world, endWorld=world.
        host.render();
    }

    public void updateSelectionPreview(Point2i world) {
        if (!(host.interactionState().pointerInteraction() instanceof DungeonPaneInteractionState.SelectionInteraction s)) {
            return;
        }
        if (Objects.equals(s.endWorld(), world)) {
            return;
        }
        s.setEndWorld(world);
        host.render();
    }

    public void commitSelection(Point2i start, Point2i end) {
        DungeonRoomCluster c = selectionAreaProjection.findClusterInSelection(start, end);
        if (c != null) {
            host.onClusterSelected(c);
        }
        clearSelectionPreview();
        host.render();
    }

    public void beginPaint(Point2i world) {
        // PaintInteraction(world) was already set with startCell=world, endCell=world.
        if (host.interactionState().pointerInteraction() instanceof DungeonPaneInteractionState.PaintInteraction state) {
            boolean alreadySet = Objects.equals(state.startCell(), world) && Objects.equals(state.endCell(), world);
            if (alreadySet && !host.previewState().paintCells().isEmpty()) {
                return;
            }
        }
        rebuildPaintPreviewCells();
        host.render();
    }

    public void updatePaintPreview(Point2i world) {
        if (!(host.interactionState().pointerInteraction() instanceof DungeonPaneInteractionState.PaintInteraction state)) {
            return;
        }
        if (Objects.equals(state.endCell(), world)) {
            return;
        }
        state.setEndCell(world);
        rebuildPaintPreviewCells();
        host.render();
    }

    public void commitPaint(Point2i world) {
        if (!(host.interactionState().pointerInteraction() instanceof DungeonPaneInteractionState.PaintInteraction state)) {
            return;
        }
        state.setEndCell(world);
        rebuildPaintPreviewCells();
        applyPaintCommit();
        host.previewState().paintCells().clear();
        host.render();
    }

    public void updateDragPreview(DungeonPaneInteractionState.DragInteraction dragInteraction) {
        double worldX = host.worldX(host.lastPointerScreenX());
        double worldY = host.worldY(host.lastPointerScreenY());
        double previewCenterX = dragInteraction.originalCenter().x() + (worldX - dragInteraction.anchorWorldX());
        double previewCenterY = dragInteraction.originalCenter().y() + (worldY - dragInteraction.anchorWorldY());
        Point2i snappedPreviewCenter = snapDraggedCenter(previewCenterX, previewCenterY);
        Point2D previewOffset = new Point2D(
                previewCenterX - snappedPreviewCenter.x(),
                previewCenterY - snappedPreviewCenter.y());
        Point2i previousCenter = host.previewState().clusterCenters().get(dragInteraction.cluster().clusterId());
        Point2D previousOffset = host.previewState().clusterOffsets().get(dragInteraction.cluster().clusterId());
        if (Objects.equals(previousCenter, snappedPreviewCenter)
                && Objects.equals(previousOffset, previewOffset)) {
            return;
        }
        host.previewState().clusterCenters().put(dragInteraction.cluster().clusterId(), snappedPreviewCenter);
        host.previewState().clusterOffsets().put(dragInteraction.cluster().clusterId(), previewOffset);
        if (!Objects.equals(previousCenter, snappedPreviewCenter)) {
            host.rebuildClusterDragPreview();
        }
        host.render();
    }

    public void commitDrag(DungeonPaneInteractionState.DragInteraction dragInteraction) {
        double worldX = host.worldX(host.lastPointerScreenX());
        double worldY = host.worldY(host.lastPointerScreenY());
        Point2i newCenter = snapDraggedCenter(
                dragInteraction.originalCenter().x() + (worldX - dragInteraction.anchorWorldX()),
                dragInteraction.originalCenter().y() + (worldY - dragInteraction.anchorWorldY()));
        if (!newCenter.equals(dragInteraction.originalCenter())) {
            // Keep the drag preview visible until the async move result replaces the layout.
            // Dropping the preview immediately would repaint the stale layout for one frame.
            host.onClusterMoved(dragInteraction.cluster(), newCenter);
        } else {
            host.previewState().clusterCenters().remove(dragInteraction.cluster().clusterId());
            host.previewState().clusterOffsets().remove(dragInteraction.cluster().clusterId());
            host.rebuildClusterDragPreview();
            host.render();
        }
    }

    public boolean updateHoveredCorridorAt(features.world.quarantine.dungeonmap.foundation.geometry.ScreenPoint screen) {
        Long nextHoveredCorridorId = null;
        if (host.layoutPresent() && host.editorTool() == DungeonEditorTool.SELECT) {
            var hoveredCluster = host.findClusterAt(screen);
            var hoveredRoom = hoveredCluster == null ? host.findRoomAt(screen) : null;
            if (hoveredCluster == null && hoveredRoom == null) {
                var corridor = host.findCorridorAt(screen);
                nextHoveredCorridorId = corridor == null ? null : corridor.corridorId();
            }
        }
        if (Objects.equals(host.previewState().hoveredCorridorId(), nextHoveredCorridorId)) {
            return false;
        }
        host.previewState().setHoveredCorridorId(nextHoveredCorridorId);
        return true;
    }

    public boolean clearHoveredCorridor() {
        if (host.previewState().hoveredCorridorId() == null) {
            return false;
        }
        host.previewState().setHoveredCorridorId(null);
        return true;
    }

    public void updatePointerPosition(MouseEvent event) {
        host.updateTrackerPosition(event.getX(), event.getY());
    }

    public void refreshHoverAfterProjectionChange() {
        if (!host.pointerInsideCanvas()) {
            if (clearHoveredCorridor()) {
                host.render();
            }
            return;
        }
        if (updateHoveredCorridorAt(new features.world.quarantine.dungeonmap.foundation.geometry.ScreenPoint(host.lastPointerScreenX(), host.lastPointerScreenY()))) {
            host.render();
        }
    }

    public void onPointerExited() {
        host.clearTrackerState();
        if (clearHoveredCorridor()) {
            host.render();
        }
    }

    private void applyPaintCommit() {
        if (!host.previewState().paintCells().isEmpty()) {
            Set<Point2i> cells = Set.copyOf(host.previewState().paintCells());
            if (host.editorTool() == DungeonEditorTool.ROOM_DELETE) {
                host.onRoomCellsDeleted(cells);
            } else {
                host.onRoomCellsPainted(cells);
            }
        }
    }

    private Point2i snapDraggedCenter(double worldX, double worldY) {
        return host.viewMode() == DungeonViewMode.GRAPH
                ? new Point2i((int) Math.round(worldX), (int) Math.round(worldY))
                : new Point2i((int) Math.floor(worldX), (int) Math.floor(worldY));
    }

    public interface Host extends DungeonPaneContext {
        DungeonPaneInteractionState interactionState();
        double lastPointerScreenX();
        double lastPointerScreenY();
        boolean pointerInsideCanvas();
        void updateTrackerPosition(double x, double y);
        void clearTrackerState();
        DungeonPreviewState previewState();
        DungeonEditorTool editorTool();
        DungeonViewMode viewMode();
        boolean layoutPresent();
        void clearCorridorPressModePreview();
        boolean clearCorridorDoorPreview();
        void onClusterSelected(DungeonRoomCluster cluster);
        void onRoomCellsPainted(Set<Point2i> cells);
        void onRoomCellsDeleted(Set<Point2i> cells);
        void onClusterMoved(DungeonRoomCluster cluster, Point2i center);
        void rebuildClusterDragPreview();
        void render();
        double worldX(double screenX);
        double worldY(double screenY);
        DungeonRoomCluster findClusterAt(features.world.quarantine.dungeonmap.foundation.geometry.ScreenPoint screen);
        features.world.quarantine.dungeonmap.rooms.model.DungeonRoom findRoomAt(features.world.quarantine.dungeonmap.foundation.geometry.ScreenPoint screen);
        features.world.quarantine.dungeonmap.corridors.model.DungeonCorridor findCorridorAt(features.world.quarantine.dungeonmap.foundation.geometry.ScreenPoint screen);
    }
}
