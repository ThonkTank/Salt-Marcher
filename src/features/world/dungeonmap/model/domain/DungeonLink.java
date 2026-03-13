package features.world.dungeonmap.model.domain;

public record DungeonLink(
        Long linkId,
        Long mapId,
        DungeonLinkAnchor fromAnchor,
        DungeonLinkAnchor toAnchor,
        String label,
        String notes
) {
}
