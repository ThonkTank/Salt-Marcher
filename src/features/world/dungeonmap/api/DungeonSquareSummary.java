package features.world.dungeonmap.api;

public record DungeonSquareSummary(
        int x,
        int y,
        String roomName,
        String areaName
) {}
