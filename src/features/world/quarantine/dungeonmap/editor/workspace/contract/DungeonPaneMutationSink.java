package features.world.quarantine.dungeonmap.editor.workspace.contract;

import features.world.quarantine.dungeonmap.editor.selection.CorridorDoorHandle;
import features.world.quarantine.dungeonmap.editor.selection.CorridorWaypointHandle;
import features.world.quarantine.dungeonmap.editor.workspace.corridor.CorridorDoorMoveTarget;
import features.world.quarantine.dungeonmap.editor.workspace.corridor.CorridorRoomRemoval;
import features.world.quarantine.dungeonmap.editor.workspace.corridor.CorridorWaypointInsert;
import features.world.quarantine.dungeonmap.corridors.model.DungeonCorridor;
import features.world.quarantine.dungeonmap.rooms.model.DungeonClusterEdgeRef;
import features.world.quarantine.dungeonmap.rooms.model.DungeonRoomCluster;
import features.world.quarantine.dungeonmap.foundation.geometry.Point2i;

import java.util.Set;

public interface DungeonPaneMutationSink {

    void onClusterMoved(DungeonRoomCluster cluster, Point2i center);

    void onRoomCellsPainted(Set<Point2i> cells);

    void onRoomCellsDeleted(Set<Point2i> cells);

    void onClusterDoorPainted(Set<DungeonClusterEdgeRef> edgeRefs);

    void onClusterDoorDeleted(Set<DungeonClusterEdgeRef> edgeRefs);

    void onGraphRoomRequested(Point2i center);

    void onGraphClusterDeleted(DungeonRoomCluster cluster);

    void onCorridorDeleted(DungeonCorridor corridor);

    void onCorridorRoomRemoved(CorridorRoomRemoval removal);

    void onCorridorDoorMoved(CorridorDoorHandle handle, CorridorDoorMoveTarget target);

    void onCorridorWaypointAdded(CorridorWaypointInsert insert);

    void onCorridorWaypointRemoved(CorridorWaypointHandle handle);

    void onCorridorWaypointMoved(CorridorWaypointHandle handle, Point2i cell);
}
