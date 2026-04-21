package src.domain.dungeon.map.value;

import org.jspecify.annotations.Nullable;

public record DungeonTravelMoveFacts(
        DungeonTravelMoveStatus status,
        String message,
        DungeonTravelSurfaceFacts surface,
        @Nullable DungeonTravelExternalTargetFacts externalTarget
) {

    public DungeonTravelMoveFacts(
            DungeonTravelMoveStatus status,
            String message,
            DungeonTravelSurfaceFacts surface
    ) {
        this(status, message, surface, null);
    }

    public DungeonTravelMoveFacts {
        status = status == null ? DungeonTravelMoveStatus.NO_MAP : status;
        message = message == null ? "" : message.trim();
    }
}
