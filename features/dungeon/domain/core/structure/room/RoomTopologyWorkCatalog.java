package features.dungeon.domain.core.structure.room;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import features.dungeon.domain.core.structure.topology.SpatialTopology;

public final class RoomTopologyWorkCatalog {

    private static final long NO_ID = 0L;
    private static final RoomCellCoverage CELL_COVERAGE = new RoomCellCoverage();

    public List<DungeonRoomTopologyClusterWork> workClusters(SpatialTopology topology, RoomCatalog rooms) {
        Map<Long, List<RoomRegion>> roomsByCluster = safeRooms(rooms).roomsByCluster();
        List<DungeonRoomTopologyClusterWork> result = new ArrayList<>();
        for (RoomCluster cluster : safeTopology(topology).roomClusters()) {
            List<RoomRegion> clusterRooms = roomsByCluster.getOrDefault(cluster.clusterId(), List.of());
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
        List<RoomRegion> clusterRooms = safeRooms(rooms).roomsInCluster(clusterId);
        for (RoomCluster cluster : safeTopology(topology).roomClusters()) {
            if (cluster != null && cluster.clusterId() == clusterId) {
                return Optional.of(clusterWork(cluster, clusterRooms));
            }
        }
        return Optional.empty();
    }

    public ReservedIdentities reservedIdentities(
            long firstClusterId,
            int clusterCount,
            long firstRoomId,
            int roomCount
    ) {
        return new ReservedIdentities(firstClusterId, clusterCount, firstRoomId, roomCount);
    }

    private static SpatialTopology safeTopology(SpatialTopology topology) {
        return topology == null ? SpatialTopology.empty() : topology;
    }

    private static RoomCatalog safeRooms(RoomCatalog rooms) {
        return rooms == null ? RoomCatalog.empty() : rooms;
    }

    private static DungeonRoomTopologyClusterWork clusterWork(
            RoomCluster cluster,
            List<RoomRegion> rooms
    ) {
        return new DungeonRoomTopologyClusterWork(
                cluster,
                rooms,
                CELL_COVERAGE.cellsByLevel(cluster, rooms));
    }

    public static final class ReservedIdentities {

        private final long firstClusterId;
        private final long clusterLimitExclusive;
        private final long firstRoomId;
        private final long roomLimitExclusive;

        public ReservedIdentities(
                long firstClusterId,
                int clusterCount,
                long firstRoomId,
                int roomCount
        ) {
            if (firstClusterId < 1L || clusterCount < 1 || firstRoomId < 1L || roomCount < 1) {
                throw new IllegalArgumentException("room identity reservations must be positive");
            }
            this.firstClusterId = firstClusterId;
            this.clusterLimitExclusive = Math.addExact(firstClusterId, clusterCount);
            this.firstRoomId = firstRoomId;
            this.roomLimitExclusive = Math.addExact(firstRoomId, roomCount);
        }

        public long firstClusterId() {
            return firstClusterId;
        }

        public long firstRoomId() {
            return firstRoomId;
        }

        long clusterLimitExclusive() {
            return clusterLimitExclusive;
        }

        long roomLimitExclusive() {
            return roomLimitExclusive;
        }

        void validateAllocatedRooms(List<RoomRegion> rooms) {
            for (RoomRegion room : rooms == null ? List.<RoomRegion>of() : rooms) {
                if (room != null && room.roomId() >= firstRoomId && room.roomId() >= roomLimitExclusive) {
                    throw new IllegalStateException("room identity reservation exhausted");
                }
            }
        }
    }
}
