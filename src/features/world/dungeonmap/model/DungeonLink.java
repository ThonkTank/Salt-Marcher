package features.world.dungeonmap.model;

public record DungeonLink(
        Long linkId,
        Long mapId,
        Long fromEndpointId,
        Long toEndpointId,
        String label,
        String notes
) {
}
