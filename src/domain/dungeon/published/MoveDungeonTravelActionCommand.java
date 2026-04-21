package src.domain.dungeon.published;

import org.jspecify.annotations.Nullable;

public record MoveDungeonTravelActionCommand(
        @Nullable DungeonTravelPosition position,
        String actionId
) {

    public MoveDungeonTravelActionCommand {
        actionId = actionId == null ? "" : actionId.trim();
    }
}
