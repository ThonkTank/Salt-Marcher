package features.world.dungeon.room.input;

import java.util.List;

public record SaveNarrationInput(
        long roomId,
        String visualDescription,
        List<SaveNarrationExitInput> exitNarrations
) {
}
