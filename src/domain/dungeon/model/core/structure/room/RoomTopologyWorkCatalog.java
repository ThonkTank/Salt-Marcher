package src.domain.dungeon.model.core.structure.room;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import src.domain.dungeon.model.core.structure.topology.SpatialTopology;

public final class RoomTopologyWorkCatalog {

    private static final long NO_ID = 0L;
    private static final RoomCellCoverage CELL_COVERAGE = new RoomCellCoverage();

    public List<DungeonRoomTopologyClusterWork> workClusters(SpatialTopology topology, RoomCatalog rooms) {
        Map<Long, List<DungeonRoom>> roomsByCluster = roomsByCluster(rooms == null ? List.of() : rooms.rooms());
        List<DungeonRoomTopologyClusterWork> result = new ArrayList<>();
        for (DungeonRoomCluster cluster : safeTopology(topology).roomClusters()) {
            List<DungeonRoom> clusterRooms = roomsByCluster.getOrDefault(cluster.clusterId(), List.of());
            result.add(clusterWork(cluster, clusterRooms));
        }
        return result;
    }

    public Optional<DungeonRoomTopologyClusterWork> workCluster(
            SpatialTopology topology,
            RoomCatalog rooms,
            long clusterId
    ) {
        if (clusterId <= NO_ID) {
            return Optional.empty();
        }
        List<DungeonRoom> clusterRooms = roomsInCluster(rooms, clusterId);
        for (DungeonRoomCluster cluster : safeTopology(topology).roomClusters()) {
            if (cluster != null && cluster.clusterId() == clusterId) {
                return Optional.of(clusterWork(cluster, clusterRooms));
            }
        }
        return Optional.empty();
    }

    public RoomClusterCollection coreClusters(List<DungeonRoomTopologyClusterWork> clusters) {
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

    public List<DungeonRoomTopologyClusterWork> fromCoreClusters(
            RoomClusterCollection coreClusters,
            List<DungeonRoomTopologyClusterWork> previousClusters
    ) {
        Map<Long, DungeonRoomTopologyClusterWork> previousByClusterId = previousByClusterId(previousClusters);
        List<DungeonRoomTopologyClusterWork> result = new ArrayList<>();
        for (RoomClusterWork work : coreClusters == null
                ? List.<RoomClusterWork>of()
                : coreClusters.clusters()) {
            if (work != null && work.cluster() != null) {
                result.add(DungeonRoomTopologyClusterWork.fromCore(
                        work,
                        previousByClusterId.get(work.cluster().clusterId())));
            }
        }
        return result;
    }

    public IdAllocation newIdAllocation(SpatialTopology topology, RoomCatalog rooms) {
        return new IdAllocation(topology, rooms);
    }

    private static SpatialTopology safeTopology(SpatialTopology topology) {
        return topology == null ? SpatialTopology.empty() : topology;
    }

    private Map<Long, List<DungeonRoom>> roomsByCluster(List<DungeonRoom> rooms) {
        Map<Long, List<DungeonRoom>> result = new LinkedHashMap<>();
        for (DungeonRoom room : rooms == null ? List.<DungeonRoom>of() : rooms) {
            if (room != null) {
                List<DungeonRoom> clusterRooms = result.get(room.clusterId());
                if (clusterRooms == null) {
                    clusterRooms = new ArrayList<>();
                    result.put(room.clusterId(), clusterRooms);
                }
                clusterRooms.add(room);
            }
        }
        return Map.copyOf(result);
    }

    private static List<DungeonRoom> roomsInCluster(RoomCatalog rooms, long clusterId) {
        List<DungeonRoom> result = new ArrayList<>();
        for (DungeonRoom room : rooms == null ? List.<DungeonRoom>of() : rooms.rooms()) {
            if (room != null && room.clusterId() == clusterId) {
                result.add(room);
            }
        }
        return List.copyOf(result);
    }

    private static DungeonRoomTopologyClusterWork clusterWork(
            DungeonRoomCluster cluster,
            List<DungeonRoom> rooms
    ) {
        return new DungeonRoomTopologyClusterWork(
                cluster,
                rooms,
                CELL_COVERAGE.cellsByLevel(cluster, rooms));
    }

    private Map<Long, DungeonRoomTopologyClusterWork> previousByClusterId(
            List<DungeonRoomTopologyClusterWork> previousClusters
    ) {
        Map<Long, DungeonRoomTopologyClusterWork> result = new LinkedHashMap<>();
        List<DungeonRoomTopologyClusterWork> safeClusters =
                previousClusters == null ? List.of() : previousClusters;
        for (DungeonRoomTopologyClusterWork work : safeClusters) {
            if (work != null && work.cluster() != null) {
                result.put(work.cluster().clusterId(), work);
            }
        }
        return Map.copyOf(result);
    }

    public static final class IdAllocation {

        private final long nextClusterId;
        private final long nextRoomId;

        IdAllocation(SpatialTopology topology, RoomCatalog rooms) {
            this.nextClusterId = nextClusterId(topology);
            this.nextRoomId = nextRoomId(rooms);
        }

        private static long nextClusterId(SpatialTopology topology) {
            long result = 0L;
            for (DungeonRoomCluster cluster : safeTopology(topology).roomClusters()) {
                if (cluster != null && cluster.clusterId() > result) {
                    result = cluster.clusterId();
                }
            }
            return result + 1L;
        }

        private static long nextRoomId(RoomCatalog rooms) {
            long result = 0L;
            for (DungeonRoom room : rooms == null ? List.<DungeonRoom>of() : rooms.rooms()) {
                if (room != null && room.roomId() > result) {
                    result = room.roomId();
                }
            }
            return result + 1L;
        }

        public RoomClusterCollection.IdAllocation toCore() {
            return new RoomClusterCollection.IdAllocation(nextClusterId, nextRoomId);
        }

        public long nextRoomId() {
            return nextRoomId;
        }
    }
}
