package src.data.dungeon.model;

public record DungeonRoomExitDescriptionRecord(
        long roomId,
        int cellX,
        int cellY,
        String edgeDirection,
        String description
) {

    public DungeonRoomExitDescriptionRecord {
        edgeDirection = edgeDirection == null || edgeDirection.isBlank() ? "NORTH" : edgeDirection;
        description = description == null ? "" : description;
    }
}
