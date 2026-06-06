package src.domain.dungeon.model.worldspace;

import src.domain.dungeon.model.core.structure.room.DungeonRoomCluster;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import src.domain.dungeon.model.core.structure.room.RoomClusterCollection;
import src.domain.dungeon.model.core.structure.room.RoomClusterWork;

final class DungeonRoomClusterWorkLogic {

    private static final DungeonRoomCellProjection CELL_PROJECTOR = new DungeonRoomCellProjection();

    List<DungeonRoomTopologyClusterWork> workClusters(DungeonMap dungeonMap) {
        Map<Long, List<DungeonRoom>> roomsByCluster = roomsByCluster(dungeonMap.rooms().rooms());
        List<DungeonRoomTopologyClusterWork> result = new ArrayList<>();
        for (DungeonRoomCluster cluster : dungeonMap.topology().roomClusters()) {
            List<DungeonRoom> rooms = roomsByCluster.getOrDefault(cluster.clusterId(), List.of());
            result.add(workCluster(cluster, rooms));
        }
        return result;
    }

    DungeonRoomTopologyClusterWork workCluster(DungeonMap dungeonMap, long clusterId) {
        if (dungeonMap == null || clusterId <= 0L) {
            return null;
        }
        List<DungeonRoom> rooms = roomsForCluster(dungeonMap.rooms().rooms(), clusterId);
        for (DungeonRoomCluster cluster : dungeonMap.topology().roomClusters()) {
            if (cluster != null && cluster.clusterId() == clusterId) {
                return workCluster(cluster, rooms);
            }
        }
        return null;
    }

    RoomClusterCollection coreClusters(List<DungeonRoomTopologyClusterWork> clusters) {
        List<RoomClusterWork> coreClusters = new ArrayList<>();
        List<DungeonRoomTopologyClusterWork> safeClusters =
                clusters == null ? List.of() : clusters;
        for (DungeonRoomTopologyClusterWork work : safeClusters) {
            if (work != null) {
                coreClusters.add(work.toCore());
            }
        }
        return new RoomClusterCollection(coreClusters);
    }

    List<DungeonRoomTopologyClusterWork> fromCoreClusters(
            RoomClusterCollection coreClusters,
            List<DungeonRoomTopologyClusterWork> previousClusters
    ) {
        Map<Long, DungeonRoomTopologyClusterWork> previousByClusterId = previousByClusterId(previousClusters);
        List<DungeonRoomTopologyClusterWork> result = new ArrayList<>();
        for (RoomClusterWork work : coreClusters.clusters()) {
            result.add(DungeonRoomTopologyClusterWork.fromCore(
                    work,
                    previousByClusterId.get(work.cluster().clusterId())));
        }
        return result;
    }

    IdAllocation newIdAllocation(DungeonMap dungeonMap) {
        return new IdAllocation(dungeonMap);
    }

    RoomClusterCollection.IdAllocation newCoreIdAllocation(DungeonMap dungeonMap) {
        return newIdAllocation(dungeonMap).toCore();
    }

    private Map<Long, List<DungeonRoom>> roomsByCluster(List<DungeonRoom> rooms) {
        Map<Long, List<DungeonRoom>> result = new LinkedHashMap<>();
        for (DungeonRoom room : rooms == null ? List.<DungeonRoom>of() : rooms) {
            List<DungeonRoom> clusterRooms = result.get(room.clusterId());
            if (clusterRooms == null) {
                clusterRooms = new ArrayList<>();
                result.put(room.clusterId(), clusterRooms);
            }
            clusterRooms.add(room);
        }
        return Map.copyOf(result);
    }

    private static List<DungeonRoom> roomsForCluster(List<DungeonRoom> rooms, long clusterId) {
        List<DungeonRoom> result = new ArrayList<>();
        for (DungeonRoom room : rooms == null ? List.<DungeonRoom>of() : rooms) {
            if (room != null && room.clusterId() == clusterId) {
                result.add(room);
            }
        }
        return List.copyOf(result);
    }

    private static DungeonRoomTopologyClusterWork workCluster(
            DungeonRoomCluster cluster,
            List<DungeonRoom> rooms
    ) {
        return new DungeonRoomTopologyClusterWork(
                cluster,
                rooms,
                CELL_PROJECTOR.cellsByLevel(cluster, rooms));
    }

    private Map<Long, DungeonRoomTopologyClusterWork> previousByClusterId(
            List<DungeonRoomTopologyClusterWork> previousClusters
    ) {
        Map<Long, DungeonRoomTopologyClusterWork> result = new LinkedHashMap<>();
        List<DungeonRoomTopologyClusterWork> safeClusters =
                previousClusters == null ? List.of() : previousClusters;
        for (DungeonRoomTopologyClusterWork work : safeClusters) {
            if (work != null) {
                result.put(work.cluster().clusterId(), work);
            }
        }
        return Map.copyOf(result);
    }

    static final class IdAllocation {

        private long nextClusterId;
        private long nextRoomId;

        IdAllocation(DungeonMap dungeonMap) {
            this.nextClusterId = nextClusterId(dungeonMap);
            this.nextRoomId = nextRoomId(dungeonMap);
        }

        private static long nextClusterId(DungeonMap dungeonMap) {
            long result = 0L;
            for (DungeonRoomCluster cluster : dungeonMap.topology().roomClusters()) {
                if (cluster != null && cluster.clusterId() > result) {
                    result = cluster.clusterId();
                }
            }
            return result + 1L;
        }

        private static long nextRoomId(DungeonMap dungeonMap) {
            long result = 0L;
            for (DungeonRoom room : dungeonMap.rooms().rooms()) {
                if (room != null && room.roomId() > result) {
                    result = room.roomId();
                }
            }
            return result + 1L;
        }

        RoomClusterCollection.IdAllocation toCore() {
            return new RoomClusterCollection.IdAllocation(nextClusterId, nextRoomId);
        }

        long nextRoomId() {
            return nextRoomId;
        }
    }
}
