package features.world.dungeonmap.editor.workspace.ui.base;

import features.world.dungeonmap.editor.session.application.CorridorDoorHandle;
import features.world.dungeonmap.editor.session.application.CorridorWaypointHandle;
import features.world.dungeonmap.editor.workspace.ui.corridor.CorridorDoorHit;
import features.world.dungeonmap.editor.workspace.ui.corridor.CorridorEditInteractionController;
import features.world.dungeonmap.corridors.model.DungeonCorridor;
import features.world.dungeonmap.rooms.model.DungeonClusterEdgeRef;
import features.world.dungeonmap.rooms.model.DungeonRoomCluster;
import features.world.dungeonmap.foundation.geometry.Point2i;

import java.util.Set;

public interface DungeonPaneEditSink {

    default void onClusterMoved(DungeonRoomCluster cluster, Point2i center) {
    }

    default void onRoomCellsPainted(Set<Point2i> cells) {
    }

    default void onRoomCellsDeleted(Set<Point2i> cells) {
    }

    default void onClusterDoorPainted(Set<DungeonClusterEdgeRef> edgeRefs) {
    }

    default void onClusterDoorDeleted(Set<DungeonClusterEdgeRef> edgeRefs) {
    }

    default void onGraphRoomRequested(Point2i center) {
    }

    default void onGraphClusterDeleted(DungeonRoomCluster cluster) {
    }

    default void onCorridorDeleted(DungeonCorridor corridor) {
    }

    default void onCorridorRoomRemoved(CorridorDoorHit hit) {
    }

    default void onCorridorDoorMoved(
            CorridorDoorHandle handle,
            CorridorEditInteractionController.DoorMoveTarget target
    ) {
    }

    default void onCorridorWaypointAdded(CorridorEditInteractionController.SegmentInsertHit hit) {
    }

    default void onCorridorWaypointRemoved(CorridorWaypointHandle handle) {
    }

    default void onCorridorWaypointMoved(CorridorWaypointHandle handle, Point2i cell) {
    }
}
