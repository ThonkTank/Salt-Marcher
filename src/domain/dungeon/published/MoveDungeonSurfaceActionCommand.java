package src.domain.dungeon.published;

import org.jspecify.annotations.Nullable;

public record MoveDungeonSurfaceActionCommand(
        @Nullable DungeonTravelPosition position,
        String actionId
) {

    public MoveDungeonSurfaceActionCommand {
        actionId = actionId == null ? "" : actionId.trim();
    }
}
