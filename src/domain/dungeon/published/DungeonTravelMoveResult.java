package src.domain.dungeon.published;

import org.jspecify.annotations.Nullable;

public record DungeonTravelMoveResult(
        DungeonTravelMoveStatus status,
        String message,
        DungeonTravelSurfaceSnapshot surface,
        @Nullable DungeonTravelExternalTarget externalTarget
) {

    public DungeonTravelMoveResult {
        status = status == null ? DungeonTravelMoveStatus.NO_MAP : status;
        message = message == null ? "" : message.trim();
    }
}
