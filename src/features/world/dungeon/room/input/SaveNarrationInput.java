package features.world.dungeon.room.input;

import java.util.List;

@SuppressWarnings("unused")
public record SaveNarrationInput(
        long roomId,
        String visualDescription,
        List<ExitNarrationInput> exitNarrations
) {
    public record ExitNarrationInput(
            int levelZ,
            int roomCellX,
            int roomCellY,
            int roomCellZ,
            String direction,
            String description
    ) {
    }
}
