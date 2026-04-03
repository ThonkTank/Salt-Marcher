package features.campaignstate.api;

public record DungeonTilePosition(
        Long mapId,
        Integer levelZ,
        Integer cellX,
        Integer cellY,
        String heading
) {
    public DungeonTilePosition {
        heading = heading == null || heading.isBlank() ? null : heading.trim();
    }
}
