package features.world.quarantine.dungeonmap.editor.workspace.interaction;

import features.world.quarantine.dungeonmap.editor.selection.CorridorDoorHandle;
import features.world.quarantine.dungeonmap.editor.selection.CorridorWaypointHandle;
import features.world.quarantine.dungeonmap.editor.session.edit.DungeonEditorEditCommand;
import features.world.quarantine.dungeonmap.editor.workspace.corridor.CorridorDoorMoveTarget;
import features.world.quarantine.dungeonmap.editor.workspace.corridor.CorridorRoomRemoval;
import features.world.quarantine.dungeonmap.editor.workspace.corridor.CorridorWaypointInsert;
import features.world.quarantine.dungeonmap.editor.workspace.contract.DungeonEditorWorkspaceSink;
import features.world.quarantine.dungeonmap.editor.workspace.contract.DungeonPaneInteractionSink;
import features.world.quarantine.dungeonmap.corridors.model.DungeonCorridor;
import features.world.quarantine.dungeonmap.corridors.model.DungeonCorridorEndpoint;
import features.world.quarantine.dungeonmap.rooms.model.DungeonClusterEdgeRef;
import features.world.quarantine.dungeonmap.rooms.model.DungeonRoom;
import features.world.quarantine.dungeonmap.rooms.model.DungeonRoomCluster;
import features.world.quarantine.dungeonmap.foundation.geometry.Point2i;
import javafx.geometry.Point2D;

import java.util.List;
import java.util.Set;
import java.util.function.Consumer;
import java.util.function.Supplier;

public final class DungeonPaneEventTranslator implements DungeonPaneInteractionSink {

    @FunctionalInterface
    public interface ZoomHandler {
        void zoom(double screenX, double screenY, double factor);
    }

    private final Supplier<DungeonEditorWorkspaceSink> workspaceSinkSupplier;
    private final Consumer<CorridorDoorHandle> doorSelectionHandler;
    private final Consumer<Point2D> panStartHandler;
    private final Consumer<Point2D> panHandler;
    private final ZoomHandler zoomHandler;

    public DungeonPaneEventTranslator(
            Supplier<DungeonEditorWorkspaceSink> workspaceSinkSupplier,
            Consumer<CorridorDoorHandle> doorSelectionHandler,
            Consumer<Point2D> panStartHandler,
            Consumer<Point2D> panHandler,
            ZoomHandler zoomHandler) {
        this.workspaceSinkSupplier = workspaceSinkSupplier;
        this.doorSelectionHandler = doorSelectionHandler;
        this.panStartHandler = panStartHandler;
        this.panHandler = panHandler;
        this.zoomHandler = zoomHandler;
    }

    // Selection events — delegate to workspace sink
    @Override public void onRoomSelected(DungeonRoom room) { workspaceSinkSupplier.get().onRoomSelected(room); }
    @Override public void onClusterSelected(DungeonRoomCluster cluster) { workspaceSinkSupplier.get().onClusterSelected(cluster); }
    @Override public void onCorridorSelected(DungeonCorridor corridor) { workspaceSinkSupplier.get().onCorridorSelected(corridor); }
    @Override public void onCorridorDoorSelected(CorridorDoorHandle handle) { workspaceSinkSupplier.get().onCorridorDoorSelected(handle); }
    @Override public void onCorridorDoorSelectionChanged(CorridorDoorHandle handle) { doorSelectionHandler.accept(handle); }
    @Override public void onCorridorEndpointSelected(DungeonCorridorEndpoint endpoint) { workspaceSinkSupplier.get().onCorridorEndpointSelected(endpoint); }
    @Override public void onCorridorWaypointSelected(CorridorWaypointHandle handle) { workspaceSinkSupplier.get().onCorridorWaypointSelected(handle); }

    // Edit events — translate to DungeonEditorEditCommand and submit
    @Override public void onClusterMoved(DungeonRoomCluster cluster, Point2i center) {
        if (cluster != null && cluster.clusterId() != null)
            workspaceSinkSupplier.get().onEditRequested(new DungeonEditorEditCommand.MoveCluster(cluster.clusterId(), center));
    }
    @Override public void onRoomCellsPainted(Set<Point2i> cells) {
        workspaceSinkSupplier.get().onEditRequested(new DungeonEditorEditCommand.PaintRoomCells(cells));
    }
    @Override public void onRoomCellsDeleted(Set<Point2i> cells) {
        workspaceSinkSupplier.get().onEditRequested(new DungeonEditorEditCommand.DeleteRoomsAtCells(cells));
    }
    @Override public void onClusterDoorPainted(Set<DungeonClusterEdgeRef> edgeRefs) {
        workspaceSinkSupplier.get().onEditRequested(new DungeonEditorEditCommand.PaintClusterDoors(edgeRefs));
    }
    @Override public void onClusterDoorDeleted(Set<DungeonClusterEdgeRef> edgeRefs) {
        workspaceSinkSupplier.get().onEditRequested(new DungeonEditorEditCommand.DeleteClusterDoors(edgeRefs));
    }
    @Override public void onGraphRoomRequested(Point2i center) {
        workspaceSinkSupplier.get().onEditRequested(new DungeonEditorEditCommand.CreateGraphRoom(center));
    }
    @Override public void onGraphClusterDeleted(DungeonRoomCluster cluster) {
        if (cluster != null && cluster.clusterId() != null)
            workspaceSinkSupplier.get().onEditRequested(new DungeonEditorEditCommand.DeleteGraphCluster(cluster.clusterId()));
    }
    @Override public void onCorridorDeleted(DungeonCorridor corridor) {
        if (corridor != null && corridor.corridorId() != null)
            workspaceSinkSupplier.get().onEditRequested(new DungeonEditorEditCommand.DeleteCorridor(corridor.corridorId()));
    }
    @Override public void onCorridorRoomRemoved(CorridorRoomRemoval removal) {
        if (removal != null)
            workspaceSinkSupplier.get().onEditRequested(new DungeonEditorEditCommand.RemoveRoomFromCorridors(List.of(removal.corridorId()), removal.roomId()));
    }
    @Override public void onCorridorDoorMoved(CorridorDoorHandle handle, CorridorDoorMoveTarget target) {
        if (handle != null && target != null)
            workspaceSinkSupplier.get().onEditRequested(new DungeonEditorEditCommand.MoveCorridorDoor(
                    target.corridorId(), target.roomId(), target.cell(), DungeonRoomCluster.EdgeDirection.values()[target.direction()]));
    }
    @Override public void onCorridorWaypointAdded(CorridorWaypointInsert insert) {
        if (insert != null)
            workspaceSinkSupplier.get().onEditRequested(new DungeonEditorEditCommand.AddCorridorWaypoint(insert.corridorId(), insert.insertIndex(), insert.cell()));
    }
    @Override public void onCorridorWaypointRemoved(CorridorWaypointHandle handle) {
        if (handle != null)
            workspaceSinkSupplier.get().onEditRequested(new DungeonEditorEditCommand.DeleteCorridorWaypoint(handle.corridorId(), handle.waypointIndex()));
    }
    @Override public void onCorridorWaypointMoved(CorridorWaypointHandle handle, Point2i cell) {
        if (handle != null && cell != null)
            workspaceSinkSupplier.get().onEditRequested(new DungeonEditorEditCommand.MoveCorridorWaypoint(handle.corridorId(), handle.waypointIndex(), cell));
    }

    // Viewport events — delegate to viewport handlers
    @Override public void onViewportPanStarted(Point2D point) { panStartHandler.accept(point); }
    @Override public void onViewportPanned(Point2D point) { panHandler.accept(point); }
    @Override public void onViewportZoomed(double screenX, double screenY, double factor) { zoomHandler.zoom(screenX, screenY, factor); }
}
