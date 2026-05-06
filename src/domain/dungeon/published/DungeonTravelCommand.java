package src.domain.dungeon.published;

import org.jspecify.annotations.Nullable;

public sealed interface DungeonTravelCommand permits
        DungeonTravelCommand.LoadSurface,
        DungeonTravelCommand.MoveAction {

    record LoadSurface(@Nullable DungeonTravelPosition position) implements DungeonTravelCommand {
    }

    record MoveAction(
            @Nullable DungeonTravelPosition position,
            String actionId
    ) implements DungeonTravelCommand {

        public MoveAction {
            actionId = actionId == null ? "" : actionId;
        }
    }
}
