package features.dungeon.domain.core.structure.room;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import features.dungeon.domain.core.geometry.Cell;

final class RoomMutationClusterCreation {

    private RoomMutationClusterCreation() {
    }

    static DungeonRoomTopologyClusterWork newClusterWork(long clusterId, long roomId, long mapId, Set<Cell> cells) {
        RoomClusterWork coreWork = RoomClusterWork.newClusterWork(
                new RoomClusterWork.ClusterRoomIds(clusterId, roomId),
                mapId,
                cells);
        return fromCoreWithPerimeter(coreWork);
    }

    static DungeonRoomTopologyClusterWork newClusterShell(
            long clusterId,
            long mapId,
            Map<Integer, List<Cell>> cellsByLevel,
            List<DungeonRoom> rooms
    ) {
        RoomCluster coreCluster = RoomCluster.fromCells(clusterId, mapId, flattenedCells(cellsByLevel));
        DungeonRoomCluster baseCluster = DungeonRoomCluster.fromCore(coreCluster, Map.of());
        DungeonRoomCluster cluster = DungeonRoomCluster.fromCore(
                coreCluster,
                RoomPerimeterBoundaryMaterialization.fromFloorCells(
                        baseCluster,
                        coreCluster.floorMap().allCells(),
                        Map.of()));
        return new DungeonRoomTopologyClusterWork(cluster, rooms, cellsByLevel);
    }

    private static DungeonRoomTopologyClusterWork fromCoreWithPerimeter(RoomClusterWork coreWork) {
        DungeonRoomTopologyClusterWork work = DungeonRoomTopologyClusterWork.fromCore(coreWork, null);
        DungeonRoomCluster cluster = work.cluster().rebuiltForTopologyWork(
                work.cellsByLevel(),
                RoomPerimeterBoundaryMaterialization.fromFloorCells(work.cluster(), work.allCells(), Map.of()));
        return new DungeonRoomTopologyClusterWork(cluster, work.rooms(), work.cellsByLevel());
    }

    private static Set<Cell> flattenedCells(Map<Integer, List<Cell>> cellsByLevel) {
        Set<Cell> result = new LinkedHashSet<>();
        for (List<Cell> cells : cellsByLevel.values()) {
            result.addAll(cells);
        }
        return Set.copyOf(result);
    }
}
