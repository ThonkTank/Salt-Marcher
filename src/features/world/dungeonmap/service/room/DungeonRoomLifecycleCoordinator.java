package features.world.dungeonmap.service.room;

import features.world.dungeonmap.model.domain.DungeonRoomNodeKey;
import features.world.dungeonmap.repository.concept.DungeonConceptNodePositionRepository;
import features.world.dungeonmap.repository.connection.DungeonConnectionRepository;
import features.world.dungeonmap.repository.map.DungeonRoomRepository;

import java.sql.Connection;
import java.sql.SQLException;

public final class DungeonRoomLifecycleCoordinator {

    private DungeonRoomLifecycleCoordinator() {
    }

    public static void deleteRoom(Connection conn, long roomId) throws SQLException {
        String nodeKey = DungeonRoomNodeKey.room(roomId);
        // Grid and graph share the same room row, so every room deletion must clear graph references first.
        DungeonConnectionRepository.deleteConnectionsForNode(conn, nodeKey);
        DungeonConceptNodePositionRepository.deletePositionsForNode(conn, nodeKey);
        DungeonRoomRepository.deleteRoom(conn, roomId);
    }
}
