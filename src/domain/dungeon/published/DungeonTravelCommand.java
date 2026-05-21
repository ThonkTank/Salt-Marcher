package src.domain.dungeon.published;

import org.jspecify.annotations.Nullable;

public sealed interface DungeonTravelCommand permits
        DungeonTravelCommand.LoadSurfaceCommand,
        DungeonTravelCommand.MoveActionCommand {

    record LoadSurfaceCommand(@Nullable DungeonTravelPosition position) implements DungeonTravelCommand {
    }

    record MoveActionCommand(
            @Nullable DungeonTravelPosition position,
            String actionId
    ) implements DungeonTravelCommand {

        public MoveActionCommand {
            actionId = actionId == null ? "" : actionId;
        }
    }
}
