package features.world.dungeonmap.api;

public record DungeonRoomSummary(
        long roomId,
        String name,
        String description,
        String areaName
) {}
