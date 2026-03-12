package features.world.dungeonmap.api;

public record DungeonEndpointSummary(
        long endpointId,
        String name,
        String notes,
        String roleLabel,
        boolean defaultEntry,
        int x,
        int y
) {}
