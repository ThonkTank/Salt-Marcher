package features.dungeon.domain.core.structure.door;

import java.util.ArrayList;
import java.util.List;
import org.jspecify.annotations.Nullable;
import features.dungeon.domain.core.geometry.DungeonBoundaryKey;
import features.dungeon.domain.core.geometry.Edge;
import features.dungeon.domain.core.structure.DungeonMap;
import features.dungeon.domain.core.component.boundary.BoundarySegment;
import features.dungeon.domain.core.structure.room.RoomRegion;
import features.dungeon.domain.core.structure.room.RoomCluster;
import features.dungeon.domain.core.structure.room.RoomCellCoverage;

final class DoorBoundaryRelocationGeometry {

    private DoorBoundaryRelocationGeometry() {
    }

    static boolean targetMaterializesDoor(
            DungeonMap sourceMap,
            RoomCluster targetCluster,
            Edge nextDoorEdge,
            @Nullable BoundarySegment nextBoundary
    ) {
        return DoorBoundaryMaterialization.forEdge(
                nextDoorEdge,
                new RoomCellCoverage().cellsByRoom(targetCluster, roomsInCluster(sourceMap, targetCluster.clusterId())),
                boundaryKind(nextBoundary)).materializesDoor();
    }

    static @Nullable BoundarySegment boundaryAt(RoomCluster cluster, Edge edge) {
        DungeonBoundaryKey key = DungeonBoundaryKey.from(edge);
        for (BoundarySegment boundary : cluster.orderedAuthoredBoundaries()) {
            if (boundary != null && key.equals(DungeonBoundaryKey.from(boundary.edge()))) {
                return boundary;
            }
        }
        return null;
    }

    static List<RoomRegion> roomsInCluster(DungeonMap dungeonMap, long clusterId) {
        List<RoomRegion> result = new ArrayList<>();
        for (RoomRegion room : dungeonMap.rooms().rooms()) {
            if (room != null && room.clusterId() == clusterId) {
                result.add(room);
            }
        }
        return List.copyOf(result);
    }

    private static DoorBoundaryMaterialization.ExistingBoundaryKind boundaryKind(
            @Nullable BoundarySegment boundary
    ) {
        if (boundary == null) {
            return DoorBoundaryMaterialization.noExistingBoundary();
        }
        return boundary.isDoor()
                ? DoorBoundaryMaterialization.existingDoorBoundary()
                : DoorBoundaryMaterialization.existingNonDoorBoundary();
    }
}
