package features.world.quarantine.dungeonmap.editor.workspace.contract;

import features.world.quarantine.dungeonmap.editor.selection.CorridorDoorHandle;
import features.world.quarantine.dungeonmap.editor.selection.CorridorWaypointHandle;
import features.world.quarantine.dungeonmap.editor.workspace.corridor.CorridorDoorMoveTarget;
import features.world.quarantine.dungeonmap.editor.workspace.corridor.CorridorRoomRemoval;
import features.world.quarantine.dungeonmap.editor.workspace.corridor.CorridorWaypointInsert;
import features.world.quarantine.dungeonmap.corridors.model.DungeonCorridor;
import features.world.quarantine.dungeonmap.corridors.model.DungeonCorridorEndpoint;
import features.world.quarantine.dungeonmap.rooms.model.DungeonClusterEdgeRef;
import features.world.quarantine.dungeonmap.rooms.model.DungeonRoom;
import features.world.quarantine.dungeonmap.rooms.model.DungeonRoomCluster;
import features.world.quarantine.dungeonmap.foundation.geometry.Point2i;
import javafx.geometry.Point2D;

import java.util.Set;

public class DungeonPaneInteractionSinkAdapter implements DungeonPaneInteractionSink {

    @Override public void onRoomSelected(DungeonRoom room) {}
    @Override public void onClusterSelected(DungeonRoomCluster cluster) {}
    @Override public void onCorridorSelected(DungeonCorridor corridor) {}
    @Override public void onCorridorEndpointSelected(DungeonCorridorEndpoint endpoint) {}
    @Override public void onCorridorDoorSelected(CorridorDoorHandle handle) {}
    @Override public void onCorridorDoorSelectionChanged(CorridorDoorHandle handle) {}
    @Override public void onCorridorWaypointSelected(CorridorWaypointHandle handle) {}

    @Override public void onClusterMoved(DungeonRoomCluster cluster, Point2i center) {}
    @Override public void onRoomCellsPainted(Set<Point2i> cells) {}
    @Override public void onRoomCellsDeleted(Set<Point2i> cells) {}
    @Override public void onClusterDoorPainted(Set<DungeonClusterEdgeRef> edgeRefs) {}
    @Override public void onClusterDoorDeleted(Set<DungeonClusterEdgeRef> edgeRefs) {}
    @Override public void onGraphRoomRequested(Point2i center) {}
    @Override public void onGraphClusterDeleted(DungeonRoomCluster cluster) {}
    @Override public void onCorridorDeleted(DungeonCorridor corridor) {}
    @Override public void onCorridorRoomRemoved(CorridorRoomRemoval removal) {}
    @Override public void onCorridorDoorMoved(CorridorDoorHandle handle, CorridorDoorMoveTarget target) {}
    @Override public void onCorridorWaypointAdded(CorridorWaypointInsert insert) {}
    @Override public void onCorridorWaypointRemoved(CorridorWaypointHandle handle) {}
    @Override public void onCorridorWaypointMoved(CorridorWaypointHandle handle, Point2i cell) {}

    @Override public void onViewportPanStarted(Point2D point) {}
    @Override public void onViewportPanned(Point2D point) {}
    @Override public void onViewportZoomed(double screenX, double screenY, double factor) {}
}
