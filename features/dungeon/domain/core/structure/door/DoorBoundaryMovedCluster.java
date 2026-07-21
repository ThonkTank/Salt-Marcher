package features.dungeon.domain.core.structure.door;

import features.dungeon.domain.core.component.boundary.BoundarySegment;
import features.dungeon.domain.core.geometry.Edge;
import features.dungeon.domain.core.graph.DungeonTopologyRef;
import features.dungeon.domain.core.structure.room.RoomCluster;
import features.dungeon.domain.core.structure.room.RoomClusterDoorBoundaryMove;
import features.dungeon.domain.core.structure.room.RoomRegion;
import java.util.List;

final class DoorBoundaryMovedCluster {
    RoomCluster movedCluster(DoorBindingMoveContext context) {
        return context.targetCluster().withMovedDoorBoundary(new RoomClusterDoorBoundaryMove(
                context.oldDoorBoundary(),
                context.nextDoorEdge(),
                context.expectedTopologyRef()));
    }

    RoomCluster movedStandaloneDoor(
            RoomCluster cluster,
            BoundarySegment oldDoorBoundary,
            Edge nextDoorEdge,
            DungeonTopologyRef topologyRef,
            List<RoomRegion> rooms
    ) {
        boolean touchesCluster = new features.dungeon.domain.core.structure.room.RoomCellCoverage()
                .clusterCells(cluster, rooms, nextDoorEdge.from().level()).stream()
                .anyMatch(nextDoorEdge.touchingCells()::contains);
        return touchesCluster
                ? cluster.withMovedDoorBoundary(new RoomClusterDoorBoundaryMove(
                        oldDoorBoundary,
                        nextDoorEdge,
                        topologyRef))
                : cluster;
    }
}
