package features.world.dungeonmap.api;

public record DungeonAreaSummary(
        long areaId,
        String name,
        String description,
        String encounterTableName
) {}
