package features.world.dungeonmap.application.room;

import database.DatabaseManager;
import features.world.dungeonmap.application.support.DungeonTransactionRunner;
import features.world.dungeonmap.model.structures.room.RoomNarration;
import features.world.dungeonmap.repository.DungeonRoomRepository;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.Objects;

/**
 * Room-only workflow owner for persisted room metadata.
 */
public final class DungeonRoomApplicationService {

    private final DungeonRoomRepository roomRepository;

    public DungeonRoomApplicationService(DungeonRoomRepository roomRepository) {
        this.roomRepository = Objects.requireNonNull(roomRepository, "roomRepository");
    }

    public void saveNarration(long roomId, RoomNarration narration) throws SQLException {
        if (roomId <= 0) {
            throw new SQLException("Raum fehlt");
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn,
                    () -> roomRepository.replaceRoomNarration(conn, roomId, narration));
        }
    }
}
