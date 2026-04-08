package features.world.dungeon.room;

import database.DatabaseManager;
import features.world.dungeon.application.support.DungeonTransactionRunner;
import features.world.dungeon.room.input.SaveNarrationInput;
import features.world.dungeon.room.repository.SaveNarrationRepository;
import features.world.dungeon.room.state.SaveNarrationState;

import java.sql.Connection;
import java.sql.SQLException;

/**
 * Public root seam for room-owned narration writes.
 */
@SuppressWarnings("unused")
public final class RoomObject {

    public void saveNarration(SaveNarrationInput input) throws SQLException {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        SaveNarrationState narration = SaveNarrationState.saveNarration(input);
        try (Connection conn = DatabaseManager.getConnection()) {
            // Room saves own their DB lifecycle so callers stay on typed room requests instead of infrastructure payloads.
            DungeonTransactionRunner.inTransaction(conn, () -> SaveNarrationRepository.saveNarration(conn, narration));
        }
    }
}
