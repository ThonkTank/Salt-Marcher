package features.world.dungeonmap.api;

public record DungeonPassageSummary(
        long passageId,
        String name,
        String notes,
        String typeLabel,
        String directionLabel,
        int x,
        int y,
        String endpointName
) {}
