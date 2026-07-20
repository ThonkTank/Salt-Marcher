package features.dungeon.domain.core.structure.door;

import java.util.ArrayList;
import java.util.List;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Edge;
import features.dungeon.domain.core.graph.DungeonTopologyRef;
import features.dungeon.domain.core.structure.room.DungeonClusterBoundary;
import features.dungeon.domain.core.structure.room.RoomRegion;
import features.dungeon.domain.core.structure.room.RoomCluster;
import features.dungeon.domain.core.structure.room.RoomCellCoverage;
import features.dungeon.domain.core.structure.room.RoomClusterBoundaryMaterialization;
import features.dungeon.domain.core.structure.room.RoomClusterDoorBoundaryMove;

final class DoorBoundaryMovedCluster {
    RoomCluster movedCluster(DoorBindingMoveContext context) {
        DoorIndex doorIndex = DoorIndex.from(boundaryDoors(context.targetCluster()));
        Door movedDoor = new Door(
                context.expectedTopologyRef().id(),
                0L,
                context.targetCluster().clusterId(),
                context.newBinding().relativeCell(),
                context.newBinding().direction());
        if (!doorIndex.canMoveDoor(
                boundaryDoor(context.oldDoorBoundary(), context.targetCluster().center()),
                movedDoor)) {
            return context.targetCluster();
        }
        return context.targetCluster().withMovedDoorBoundary(new RoomClusterDoorBoundaryMove(
                context.oldDoorBoundary(),
                context.newBinding().relativeCell(),
                context.newBinding().direction(),
                context.expectedTopologyRef()));
    }

    RoomCluster movedStandaloneDoor(
            RoomCluster cluster,
            DungeonClusterBoundary oldDoorBoundary,
            Edge nextDoorEdge,
            DungeonTopologyRef topologyRef,
            List<RoomRegion> rooms
    ) {
        RoomClusterBoundaryMaterialization.BoundaryRow materialized =
                RoomClusterBoundaryMaterialization.forEdge(
                        new RoomCellCoverage().clusterCells(cluster, rooms, nextDoorEdge.from().level()),
                        cluster.center(),
                        cluster.clusterId(),
                        nextDoorEdge,
                        RoomClusterBoundaryMaterialization.BoundaryKind.DOOR);
        if (materialized == null) {
            return cluster;
        }
        DoorIndex doorIndex = DoorIndex.from(boundaryDoors(cluster));
        Door movedDoor = new Door(
                topologyRef.id(),
                0L,
                cluster.clusterId(),
                materialized.relativeCell(),
                materialized.direction());
        if (!doorIndex.canMoveDoor(boundaryDoor(oldDoorBoundary, cluster.center()), movedDoor)) {
            return cluster;
        }
        return cluster.withMovedDoorBoundary(new RoomClusterDoorBoundaryMove(
                oldDoorBoundary,
                materialized.relativeCell(),
                materialized.direction(),
                topologyRef));
    }

    private static List<Door> boundaryDoors(RoomCluster cluster) {
        List<Door> result = new ArrayList<>();
        Cell center = cluster.center();
        for (DungeonClusterBoundary boundary : cluster.orderedAuthoredBoundaries()) {
            if (boundary != null && boundary.isDoor()) {
                result.add(boundaryDoor(boundary, center));
            }
        }
        return List.copyOf(result);
    }

    private static Door boundaryDoor(DungeonClusterBoundary boundary, Cell center) {
        return new Door(
                boundary.resolvedTopologyRef(center).id(),
                0L,
                boundary.clusterId(),
                boundary.relativeCell(),
                boundary.direction());
    }
}
