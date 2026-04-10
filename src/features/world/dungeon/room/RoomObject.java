package features.world.dungeon.room;

import features.world.dungeon.room.input.PersistMetadataInput;
import features.world.dungeon.room.input.SaveNarrationInput;
import features.world.dungeon.room.repository.PersistMetadataRepository;
import features.world.dungeon.room.repository.SaveNarrationRepository;
import features.world.dungeon.room.state.PersistMetadataState;
import features.world.dungeon.room.state.SaveNarrationState;

import java.sql.SQLException;

/**
 * Public root seam for room-owned narration writes.
 */
@SuppressWarnings("unused")
public final class RoomObject {

    public void persistMetadata(PersistMetadataInput input) throws SQLException {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        PersistMetadataState state = PersistMetadataState.persistMetadata(input);
        if (input.connection() == null) {
            PersistMetadataRepository.persistMetadata(state);
            return;
        }
        PersistMetadataRepository.persistMetadata(input.connection(), state);
    }

    public void saveNarration(SaveNarrationInput input) throws SQLException {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        SaveNarrationRepository.saveNarration(SaveNarrationState.saveNarration(input));
    }
}
