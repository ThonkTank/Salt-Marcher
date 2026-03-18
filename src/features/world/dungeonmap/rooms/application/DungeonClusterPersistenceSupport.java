package features.world.dungeonmap.rooms.application;

import features.world.dungeonmap.rooms.model.DungeonClusterEdgeRef;
import features.world.dungeonmap.rooms.model.DungeonRoom;
import features.world.dungeonmap.rooms.persistence.DungeonRoomPersistenceRepository;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

final class DungeonClusterPersistenceSupport {

    private DungeonClusterPersistenceSupport() {
        throw new AssertionError("No instances");
    }

    static Map<Long, List<DungeonClusterEdgeRef>> groupEdgeRefsByClusterId(Set<DungeonClusterEdgeRef> edgeRefs) {
        Map<Long, List<DungeonClusterEdgeRef>> refsByClusterId = new LinkedHashMap<>();
        for (DungeonClusterEdgeRef ref : edgeRefs) {
            refsByClusterId.computeIfAbsent(ref.clusterId(), ignored -> new ArrayList<>()).add(ref);
        }
        return refsByClusterId;
    }

    static void reassignRoomsToCluster(Connection conn, long targetClusterId, List<DungeonRoom> roomsToReassign) throws SQLException {
        for (DungeonRoom room : roomsToReassign) {
            if (!Objects.equals(room.clusterId(), targetClusterId)) {
                DungeonRoomPersistenceRepository.reassignRoomCluster(conn, room.roomId(), targetClusterId);
            }
        }
    }

    static void deleteClusters(Connection conn, Set<Long> deletedClusterIds, long retainedClusterId) throws SQLException {
        for (Long deletedClusterId : deletedClusterIds) {
            if (!Objects.equals(deletedClusterId, retainedClusterId)) {
                DungeonRoomPersistenceRepository.deleteCluster(conn, deletedClusterId);
            }
        }
    }
}
