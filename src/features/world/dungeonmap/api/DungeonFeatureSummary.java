package features.world.dungeonmap.api;

public record DungeonFeatureSummary(
        long featureId,
        String name,
        String categoryLabel,
        String encounterName,
        String notes,
        int tileCount
) {}
