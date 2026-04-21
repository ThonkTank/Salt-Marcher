package src.domain.dungeon.map.value;

public record DungeonTravelMoveFacts(
        DungeonTravelMoveStatus status,
        String message,
        DungeonTravelSurfaceFacts surface
) {

    public DungeonTravelMoveFacts {
        status = status == null ? DungeonTravelMoveStatus.NO_MAP : status;
        message = message == null ? "" : message.trim();
    }
}
