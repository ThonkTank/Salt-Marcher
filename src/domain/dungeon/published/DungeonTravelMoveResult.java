package src.domain.dungeon.published;

public record DungeonTravelMoveResult(
        DungeonTravelMoveStatus status,
        String message,
        DungeonTravelSurfaceSnapshot surface
) {

    public DungeonTravelMoveResult {
        status = status == null ? DungeonTravelMoveStatus.NO_MAP : status;
        message = message == null ? "" : message.trim();
    }
}
