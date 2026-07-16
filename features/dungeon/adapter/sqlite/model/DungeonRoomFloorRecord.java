package features.dungeon.adapter.sqlite.model;

public record DungeonRoomFloorRecord(
        long roomId,
        int levelZ,
        int anchorX,
        int anchorY
) {
}
