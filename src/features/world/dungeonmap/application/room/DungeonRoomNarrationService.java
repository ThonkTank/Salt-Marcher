package features.world.dungeonmap.application.room;

import database.DatabaseManager;
import features.world.dungeonmap.application.support.DungeonTransactionRunner;
import features.world.dungeonmap.model.structures.room.RoomNarration;
import features.world.dungeonmap.persistence.DungeonRoomWriteRepository;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.Objects;

public final class DungeonRoomNarrationService {

    private final DungeonRoomWriteRepository roomWriteRepository;

    public DungeonRoomNarrationService(DungeonRoomWriteRepository roomWriteRepository) {
        this.roomWriteRepository = Objects.requireNonNull(roomWriteRepository, "roomWriteRepository");
    }

    public void saveNarration(long roomId, RoomNarration narration) throws SQLException {
        if (roomId <= 0) {
            throw new SQLException("Raum fehlt");
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn,
                    () -> roomWriteRepository.replaceRoomNarration(conn, roomId, narration));
        }
    }
}
