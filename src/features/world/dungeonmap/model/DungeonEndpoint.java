package features.world.dungeonmap.model;

public record DungeonEndpoint(
        Long endpointId,
        Long mapId,
        Long squareId,
        String name,
        String notes,
        DungeonEndpointRole role,
        boolean defaultEntry,
        int x,
        int y
) {
}
