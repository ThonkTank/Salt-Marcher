package src.data.dungeon.model;

public record DungeonRoomFloorRecord(
        long roomId,
        int levelZ,
        int anchorX,
        int anchorY
) {
}
