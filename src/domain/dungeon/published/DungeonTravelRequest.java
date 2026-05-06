package src.domain.dungeon.published;

import org.jspecify.annotations.Nullable;

public sealed interface DungeonTravelRequest permits
        DungeonTravelRequest.LoadSurface,
        DungeonTravelRequest.MoveAction {

    record LoadSurface(@Nullable DungeonTravelPosition position) implements DungeonTravelRequest {
    }

    record MoveAction(
            @Nullable DungeonTravelPosition position,
            String actionId
    ) implements DungeonTravelRequest {

        public MoveAction {
            actionId = actionId == null ? "" : actionId;
        }
    }
}
