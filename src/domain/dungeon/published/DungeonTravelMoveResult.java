package src.domain.dungeon.published;

import org.jspecify.annotations.Nullable;

public record DungeonTravelMoveResult(
        DungeonTravelMoveStatus status,
        String message,
        DungeonTravelSurfaceSnapshot surface,
        @Nullable DungeonTravelExternalTarget externalTarget
) {

    public DungeonTravelMoveResult(
            DungeonTravelMoveStatus status,
            String message,
            DungeonTravelSurfaceSnapshot surface
    ) {
        this(status, message, surface, null);
    }

    public DungeonTravelMoveResult {
        status = status == null ? DungeonTravelMoveStatus.NO_MAP : status;
        message = message == null ? "" : message.trim();
    }
}
