package src.domain.dungeon.model.worldspace.model;

import org.jspecify.annotations.Nullable;

public record DungeonTravelMoveFacts(
        DungeonTravelMoveStatus status,
        String message,
        DungeonTravelSurfaceFacts surface,
        @Nullable DungeonTravelExternalTargetFacts externalTarget
) {

    public DungeonTravelMoveFacts {
        status = status == null ? DungeonTravelMoveStatus.NO_MAP : status;
        message = message == null ? "" : message.trim();
    }
}
