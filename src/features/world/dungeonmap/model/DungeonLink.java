package features.world.dungeonmap.model;

public record DungeonLink(
        Long linkId,
        Long mapId,
        DungeonLinkAnchor fromAnchor,
        DungeonLinkAnchor toAnchor,
        String label,
        String notes
) {
}
