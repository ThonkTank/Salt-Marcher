package features.world.dungeon.room.input;

import java.sql.Connection;
import java.util.List;

@SuppressWarnings("unused")
public record SaveNarrationInput(
        Connection connection,
        long roomId,
        String visualDescription,
        List<ExitNarrationInput> exitNarrations
) {
    public SaveNarrationInput {
        visualDescription = visualDescription == null ? "" : visualDescription.trim();
        exitNarrations = exitNarrations == null ? List.of() : List.copyOf(exitNarrations);
    }

    public record ExitNarrationInput(
            int levelZ,
            int roomCellX,
            int roomCellY,
            int roomCellZ,
            String direction,
            String description
    ) {
        public ExitNarrationInput {
            direction = direction == null ? "" : direction.trim();
            description = description == null ? "" : description.trim();
        }
    }
}
