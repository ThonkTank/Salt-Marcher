package features.world.dungeon.room;

import features.world.dungeon.room.input.SaveNarrationInput;
import features.world.dungeon.room.repository.SaveNarrationRepository;
import features.world.dungeon.room.state.SaveNarrationState;

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
        SaveNarrationRepository.saveNarration(SaveNarrationState.saveNarration(input));
    }
}
