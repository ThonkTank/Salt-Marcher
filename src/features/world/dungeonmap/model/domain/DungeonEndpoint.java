package features.world.dungeonmap.model.domain;

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
