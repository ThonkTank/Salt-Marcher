package features.world.dungeon.room.state;

import features.world.dungeon.room.input.SaveNarrationInput;

import java.util.ArrayList;
import java.util.List;

@SuppressWarnings("unused")
public record SaveNarrationState(
        long roomId,
        String visualDescription,
        List<SaveNarrationExitState> exitNarrations
) {

    public static SaveNarrationState saveNarration(SaveNarrationInput input) {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        if (input.roomId() <= 0) {
            throw new IllegalArgumentException("roomId");
        }
        return new SaveNarrationState(
                input.roomId(),
                normalizedDescription(input.visualDescription()),
                exitNarrations(input));
    }

    private static List<SaveNarrationExitState> exitNarrations(SaveNarrationInput input) {
        List<SaveNarrationExitState> result = new ArrayList<>();
        for (SaveNarrationInput.ExitNarrationInput exit : normalizedExitNarrations(input.exitNarrations())) {
            if (exit == null) {
                continue;
            }
            result.add(new SaveNarrationExitState(
                    exit.levelZ(),
                    exit.roomCellX(),
                    exit.roomCellY(),
                    exit.roomCellZ(),
                    normalizedDirection(exit.direction()),
                    normalizedDescription(exit.description())));
        }
        return List.copyOf(result);
    }

    private static List<SaveNarrationInput.ExitNarrationInput> normalizedExitNarrations(
            List<SaveNarrationInput.ExitNarrationInput> exitNarrations
    ) {
        return exitNarrations == null ? List.of() : List.copyOf(exitNarrations);
    }

    private static String normalizedDirection(String direction) {
        return direction == null ? "" : direction.trim();
    }

    private static String normalizedDescription(String description) {
        return description == null ? "" : description.trim();
    }
}
