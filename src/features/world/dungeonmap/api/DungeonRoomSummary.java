package features.world.dungeonmap.api;

public record DungeonRoomSummary(
        Long roomId,
        Long mapId,
        String name,
        int centerX,
        int centerY,
        int relativeVertexCount,
        boolean active
) {
}
