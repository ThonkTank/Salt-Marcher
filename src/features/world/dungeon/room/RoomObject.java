package features.world.dungeon.room;

import features.world.dungeon.room.input.SaveNarrationInput;
import features.world.dungeon.room.task.SaveNarrationTask;

import java.sql.SQLException;

/**
 * Public root seam for room-owned narration writes.
 */
public final class RoomObject {

    public void saveNarration(SaveNarrationInput input) throws SQLException {
        SaveNarrationTask.saveNarration(input);
    }
}
