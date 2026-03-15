package features.world.dungeonmap.service.concept.graph;

import features.world.dungeonmap.service.room.DungeonRoomLifecycleCoordinator;

import java.sql.Connection;
import java.sql.SQLException;

public final class DungeonConceptRoomDeletionCoordinator {

    private DungeonConceptRoomDeletionCoordinator() {
    }

    public static void deleteConceptRoom(Connection conn, long conceptLevelId, long roomId) throws SQLException {
        DungeonRoomLifecycleCoordinator.deleteRoom(conn, roomId);
    }
}
