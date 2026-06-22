package src.domain.dungeon.model.core.structure.room;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import src.domain.dungeon.model.core.structure.topology.SpatialTopology;

public final class RoomTopologyWorkCatalog {

    private static final long NO_ID = 0L;
    private static final RoomCellCoverage CELL_COVERAGE = new RoomCellCoverage();

    public List<DungeonRoomTopologyClusterWork> workClusters(SpatialTopology topology, RoomCatalog rooms) {
        Map<Long, List<DungeonRoom>> roomsByCluster = safeRooms(rooms).roomsByCluster();
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
        List<DungeonRoom> clusterRooms = safeRooms(rooms).roomsInCluster(clusterId);
        for (DungeonRoomCluster cluster : safeTopology(topology).roomClusters()) {
            if (cluster != null && cluster.clusterId() == clusterId) {
                return Optional.of(clusterWork(cluster, clusterRooms));
            }
        }
        return Optional.empty();
    }

    public IdAllocation newIdAllocation(SpatialTopology topology, RoomCatalog rooms) {
        return new IdAllocation(topology, rooms);
    }

    private static SpatialTopology safeTopology(SpatialTopology topology) {
        return topology == null ? SpatialTopology.empty() : topology;
    }

    private static RoomCatalog safeRooms(RoomCatalog rooms) {
        return rooms == null ? RoomCatalog.empty() : rooms;
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

    public static final class IdAllocation {

        private final long nextClusterId;
        private final long nextRoomId;

        IdAllocation(SpatialTopology topology, RoomCatalog rooms) {
            this.nextClusterId = nextClusterId(topology);
            this.nextRoomId = nextRoomId(rooms);
        }

        IdAllocation(long nextClusterId, long nextRoomId) {
            this.nextClusterId = Math.max(1L, nextClusterId);
            this.nextRoomId = Math.max(1L, nextRoomId);
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
            return safeRooms(rooms).nextRoomId();
        }

        public long nextClusterId() {
            return nextClusterId;
        }

        public long nextRoomId() {
            return nextRoomId;
        }
    }
}
