package features.world.dungeon.room.state;

import features.world.dungeon.room.input.SaveNarrationInput;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

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
        List<SaveNarrationExitState> normalizedExitNarrations = new ArrayList<>();
        for (SaveNarrationInput.ExitNarrationInput exitNarration : input.exitNarrations()) {
            if (exitNarration == null) {
                continue;
            }
            normalizedExitNarrations.add(new SaveNarrationExitState(
                    exitNarration.levelZ(),
                    exitNarration.roomCellX(),
                    exitNarration.roomCellY(),
                    exitNarration.roomCellZ(),
                    normalizedDirection(exitNarration.direction()),
                    normalizedDescription(exitNarration.description())));
        }
        return new SaveNarrationState(
                input.roomId(),
                normalizedDescription(input.visualDescription()),
                List.copyOf(normalizedExitNarrations));
    }

    private static String normalizedDirection(String direction) {
        String normalizedDirection = direction == null ? "" : direction.trim().toUpperCase(Locale.ROOT);
        return switch (normalizedDirection) {
            case "", "N", "NORTH" -> "NORTH";
            case "E", "EAST" -> "EAST";
            case "S", "SOUTH" -> "SOUTH";
            case "W", "WEST" -> "WEST";
            default -> throw new IllegalArgumentException("direction");
        };
    }

    private static String normalizedDescription(String description) {
        return description == null ? "" : description.trim();
    }
}
