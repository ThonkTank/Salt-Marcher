package features.world.dungeonmap.model;

public record DungeonCorridor(
        Long corridorId,
        long mapId,
        long fromRoomId,
        long toRoomId
) {
}
