package features.world.quarantine.dungeonmap.inspector;

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
