package features.world.dungeonmap.editor.workspace.ui;

import features.world.dungeonmap.editor.edit.application.DungeonEditorEditCommand;
import features.world.dungeonmap.editor.session.application.CorridorDoorHandle;
import features.world.dungeonmap.editor.session.application.CorridorWaypointHandle;
import features.world.dungeonmap.editor.workspace.ui.port.DungeonEditorWorkspaceSink;
import features.world.dungeonmap.editor.workspace.ui.corridor.CorridorEditInteractionController;
import features.world.dungeonmap.editor.workspace.ui.base.DungeonPaneInteractionSink;
import features.world.dungeonmap.editor.workspace.ui.corridor.CorridorDoorHit;
import features.world.dungeonmap.corridors.model.DungeonCorridor;
import features.world.dungeonmap.corridors.model.DungeonCorridorEndpoint;
import features.world.dungeonmap.rooms.model.DungeonClusterEdgeRef;
import features.world.dungeonmap.rooms.model.DungeonRoom;
import features.world.dungeonmap.rooms.model.DungeonRoomCluster;
import features.world.dungeonmap.foundation.geometry.Point2i;
import features.world.dungeonmap.canvas.rendering.DungeonViewportZoomHandler;
import javafx.geometry.Point2D;

import java.util.Objects;
import java.util.Set;
import java.util.function.Consumer;
import java.util.function.Supplier;

final class DungeonEditorPaneInteractionForwarder implements DungeonPaneInteractionSink {

    private final DungeonEditorWorkspaceSink sink;
    private final Consumer<CorridorDoorHandle> onCorridorDoorSelectionChanged;
    private final Consumer<Point2D> onViewportPanStarted;
    private final Consumer<Point2D> onViewportPanned;
    private final DungeonViewportZoomHandler onViewportZoomed;

    DungeonEditorPaneInteractionForwarder(
            DungeonEditorWorkspaceSink sink,
            Consumer<CorridorDoorHandle> onCorridorDoorSelectionChanged,
            Consumer<Point2D> onViewportPanStarted,
            Consumer<Point2D> onViewportPanned,
            DungeonViewportZoomHandler onViewportZoomed
    ) {
        this.sink = Objects.requireNonNull(sink, "sink");
        this.onCorridorDoorSelectionChanged = Objects.requireNonNull(onCorridorDoorSelectionChanged, "onCorridorDoorSelectionChanged");
        this.onViewportPanStarted = Objects.requireNonNull(onViewportPanStarted, "onViewportPanStarted");
        this.onViewportPanned = Objects.requireNonNull(onViewportPanned, "onViewportPanned");
        this.onViewportZoomed = Objects.requireNonNull(onViewportZoomed, "onViewportZoomed");
    }

    @Override
    public void onRoomSelected(DungeonRoom room) {
        sink.onRoomSelected(room);
    }

    @Override
    public void onClusterSelected(DungeonRoomCluster cluster) {
        sink.onClusterSelected(cluster);
    }

    @Override
    public void onCorridorSelected(DungeonCorridor corridor) {
        sink.onCorridorSelected(corridor);
    }

    @Override
    public void onCorridorDoorSelected(CorridorDoorHandle handle) {
        sink.onCorridorDoorSelected(handle);
    }

    @Override
    public void onCorridorDoorSelectionChanged(CorridorDoorHandle handle) {
        onCorridorDoorSelectionChanged.accept(handle);
    }

    @Override
    public void onClusterMoved(DungeonRoomCluster cluster, Point2i center) {
        submitIfPresent(() -> cluster == null || cluster.clusterId() == null ? null
                : new DungeonEditorEditCommand.MoveCluster(cluster.clusterId(), center));
    }

    @Override
    public void onCorridorEndpointSelected(DungeonCorridorEndpoint endpoint) {
        sink.onCorridorEndpointSelected(endpoint);
    }

    @Override
    public void onRoomCellsPainted(Set<Point2i> cells) {
        submitIfPresent(() -> new DungeonEditorEditCommand.PaintRoomCells(cells));
    }

    @Override
    public void onRoomCellsDeleted(Set<Point2i> cells) {
        submitIfPresent(() -> new DungeonEditorEditCommand.DeleteRoomsAtCells(cells));
    }

    @Override
    public void onClusterDoorPainted(Set<DungeonClusterEdgeRef> edgeRefs) {
        submitIfPresent(() -> new DungeonEditorEditCommand.PaintClusterDoors(edgeRefs));
    }

    @Override
    public void onClusterDoorDeleted(Set<DungeonClusterEdgeRef> edgeRefs) {
        submitIfPresent(() -> new DungeonEditorEditCommand.DeleteClusterDoors(edgeRefs));
    }

    @Override
    public void onGraphRoomRequested(Point2i center) {
        submitIfPresent(() -> new DungeonEditorEditCommand.CreateGraphRoom(center));
    }

    @Override
    public void onGraphClusterDeleted(DungeonRoomCluster cluster) {
        submitIfPresent(() -> cluster == null || cluster.clusterId() == null ? null
                : new DungeonEditorEditCommand.DeleteGraphCluster(cluster.clusterId()));
    }

    @Override
    public void onCorridorDeleted(DungeonCorridor corridor) {
        submitIfPresent(() -> corridor == null || corridor.corridorId() == null ? null
                : new DungeonEditorEditCommand.DeleteCorridor(corridor.corridorId()));
    }

    @Override
    public void onCorridorRoomRemoved(CorridorDoorHit hit) {
        submitIfPresent(() -> hit == null || hit.isEmpty() ? null
                : new DungeonEditorEditCommand.RemoveRoomFromCorridors(hit.corridorIds(), hit.roomId()));
    }

    @Override
    public void onViewportPanStarted(Point2D point) {
        onViewportPanStarted.accept(point);
    }

    @Override
    public void onViewportPanned(Point2D point) {
        onViewportPanned.accept(point);
    }

    @Override
    public void onViewportZoomed(double screenX, double screenY, double factor) {
        onViewportZoomed.handle(screenX, screenY, factor);
    }

    @Override
    public void onCorridorDoorMoved(
            CorridorDoorHandle handle,
            CorridorEditInteractionController.DoorMoveTarget target
    ) {
        submitIfPresent(() -> handle == null || target == null ? null
                : new DungeonEditorEditCommand.MoveCorridorDoor(
                        handle.corridorId(), handle.roomId(), target.roomCell(), target.direction()));
    }

    @Override
    public void onCorridorWaypointSelected(CorridorWaypointHandle handle) {
        sink.onCorridorWaypointSelected(handle);
    }

    @Override
    public void onCorridorWaypointAdded(CorridorEditInteractionController.SegmentInsertHit hit) {
        submitIfPresent(() -> hit == null ? null
                : new DungeonEditorEditCommand.AddCorridorWaypoint(hit.corridorId(), hit.insertIndex(), hit.cell()));
    }

    @Override
    public void onCorridorWaypointRemoved(CorridorWaypointHandle handle) {
        submitIfPresent(() -> handle == null ? null
                : new DungeonEditorEditCommand.DeleteCorridorWaypoint(handle.corridorId(), handle.waypointIndex()));
    }

    @Override
    public void onCorridorWaypointMoved(CorridorWaypointHandle handle, Point2i cell) {
        submitIfPresent(() -> handle == null || cell == null ? null
                : new DungeonEditorEditCommand.MoveCorridorWaypoint(handle.corridorId(), handle.waypointIndex(), cell));
    }

    private void submitIfPresent(Supplier<DungeonEditorEditCommand> commandFactory) {
        DungeonEditorEditCommand command = commandFactory.get();
        if (command != null) {
            sink.onEditRequested(command);
        }
    }

}
