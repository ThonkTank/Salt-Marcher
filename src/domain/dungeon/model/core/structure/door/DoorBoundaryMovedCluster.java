package src.domain.dungeon.model.core.structure.door;

import java.util.ArrayList;
import java.util.List;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Edge;
import src.domain.dungeon.model.core.graph.DungeonTopologyRef;
import src.domain.dungeon.model.core.structure.room.DungeonClusterBoundary;
import src.domain.dungeon.model.core.structure.room.DungeonRoom;
import src.domain.dungeon.model.core.structure.room.DungeonRoomCluster;
import src.domain.dungeon.model.core.structure.room.RoomCellCoverage;
import src.domain.dungeon.model.core.structure.room.RoomClusterBoundaryMaterialization;
import src.domain.dungeon.model.core.structure.room.RoomClusterDoorBoundaryMove;

final class DoorBoundaryMovedCluster {
    DungeonRoomCluster movedCluster(DoorBindingMoveContext context) {
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

    DungeonRoomCluster movedStandaloneDoor(
            DungeonRoomCluster cluster,
            DungeonClusterBoundary oldDoorBoundary,
            Edge nextDoorEdge,
            DungeonTopologyRef topologyRef,
            List<DungeonRoom> rooms
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

    private static List<Door> boundaryDoors(DungeonRoomCluster cluster) {
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
