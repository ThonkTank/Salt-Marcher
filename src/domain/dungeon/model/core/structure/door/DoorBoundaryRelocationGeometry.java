package src.domain.dungeon.model.core.structure.door;

import java.util.ArrayList;
import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.geometry.DungeonBoundaryKey;
import src.domain.dungeon.model.core.geometry.Edge;
import src.domain.dungeon.model.core.structure.DungeonMap;
import src.domain.dungeon.model.core.structure.room.DungeonClusterBoundary;
import src.domain.dungeon.model.core.structure.room.DungeonRoom;
import src.domain.dungeon.model.core.structure.room.DungeonRoomCluster;
import src.domain.dungeon.model.core.structure.room.RoomCellCoverage;

final class DoorBoundaryRelocationGeometry {

    private DoorBoundaryRelocationGeometry() {
    }

    static boolean targetMaterializesDoor(
            DungeonMap sourceMap,
            DungeonRoomCluster targetCluster,
            Edge nextDoorEdge,
            @Nullable DungeonClusterBoundary nextBoundary
    ) {
        return DoorBoundaryMaterialization.forEdge(
                nextDoorEdge,
                new RoomCellCoverage().cellsByRoom(targetCluster, roomsInCluster(sourceMap, targetCluster.clusterId())),
                boundaryKind(nextBoundary)).materializesDoor();
    }

    static @Nullable DungeonClusterBoundary boundaryAt(DungeonRoomCluster cluster, Edge edge) {
        DungeonBoundaryKey key = DungeonBoundaryKey.from(edge);
        for (DungeonClusterBoundary boundary : cluster.orderedAuthoredBoundaries()) {
            if (boundary != null && key.equals(DungeonBoundaryKey.from(boundary.absoluteEdge(cluster.center())))) {
                return boundary;
            }
        }
        return null;
    }

    static List<DungeonRoom> roomsInCluster(DungeonMap dungeonMap, long clusterId) {
        List<DungeonRoom> result = new ArrayList<>();
        for (DungeonRoom room : dungeonMap.rooms().rooms()) {
            if (room != null && room.clusterId() == clusterId) {
                result.add(room);
            }
        }
        return List.copyOf(result);
    }

    private static DoorBoundaryMaterialization.ExistingBoundaryKind boundaryKind(
            @Nullable DungeonClusterBoundary boundary
    ) {
        if (boundary == null) {
            return DoorBoundaryMaterialization.noExistingBoundary();
        }
        return boundary.isDoor()
                ? DoorBoundaryMaterialization.existingDoorBoundary()
                : DoorBoundaryMaterialization.existingNonDoorBoundary();
    }
}
