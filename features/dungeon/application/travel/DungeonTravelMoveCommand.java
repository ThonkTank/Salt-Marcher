package features.dungeon.application.travel;

import features.dungeon.api.DungeonCellRef;
import features.dungeon.api.DungeonTravelActionId;
import org.jspecify.annotations.Nullable;

sealed interface DungeonTravelMoveCommand
        permits DungeonTravelMoveCommand.Action, DungeonTravelMoveCommand.Direct {

    record Action(@Nullable DungeonTravelActionId actionId) implements DungeonTravelMoveCommand {
    }

    record Direct(@Nullable DungeonCellRef target) implements DungeonTravelMoveCommand {
    }
}
