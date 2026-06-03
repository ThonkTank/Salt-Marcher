package src.domain.dungeon.model.worldspace;

import java.util.List;
import src.domain.dungeon.model.core.structure.room.RoomClusterCollection;

final class DungeonRoomRectangleMutationLogic {

    private static final DungeonRoomClusterWorkLogic WORK_SERVICE = new DungeonRoomClusterWorkLogic();
    private static final DungeonRoomClusterRebuildLogic REBUILD_SERVICE = new DungeonRoomClusterRebuildLogic();

    DungeonMap paintRectangle(DungeonMap dungeonMap, DungeonCell start, DungeonCell end) {
        if (start == null || end == null) {
            return dungeonMap;
        }
        List<DungeonRoomTopologyClusterWork> clusters = WORK_SERVICE.workClusters(dungeonMap);
        RoomClusterCollection nextCoreClusters = WORK_SERVICE.coreClusters(clusters).paintRectangle(
                start.geometry(),
                end.geometry(),
                dungeonMap.metadata().mapId().value(),
                WORK_SERVICE.newCoreIdAllocation(dungeonMap));
        List<DungeonRoomTopologyClusterWork> nextClusters = WORK_SERVICE.fromCoreClusters(nextCoreClusters, clusters);
        return REBUILD_SERVICE.rebuilt(dungeonMap, nextClusters);
    }

    DungeonMap deleteRectangle(DungeonMap dungeonMap, DungeonCell start, DungeonCell end) {
        if (start == null || end == null) {
            return dungeonMap;
        }
        List<DungeonRoomTopologyClusterWork> clusters = WORK_SERVICE.workClusters(dungeonMap);
        RoomClusterCollection nextCoreClusters = WORK_SERVICE.coreClusters(clusters).deleteRectangle(
                start.geometry(),
                end.geometry(),
                WORK_SERVICE.newCoreIdAllocation(dungeonMap));
        List<DungeonRoomTopologyClusterWork> nextClusters = WORK_SERVICE.fromCoreClusters(nextCoreClusters, clusters);
        return REBUILD_SERVICE.rebuilt(dungeonMap, nextClusters);
    }
}
