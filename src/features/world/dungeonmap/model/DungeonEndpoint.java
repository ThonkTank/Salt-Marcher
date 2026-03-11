package features.world.dungeonmap.model;

public record DungeonEndpoint(
        Long endpointId,
        Long mapId,
        Long squareId,
        String name,
        String notes,
        int x,
        int y
) {
}
