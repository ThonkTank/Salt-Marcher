package features.world.dungeonmap.model;

public record DungeonLinkAnchor(
        DungeonLinkAnchorType type,
        long anchorId
) {
    public DungeonLinkAnchor {
        if (type == null) {
            throw new IllegalArgumentException("type must not be null");
        }
        if (anchorId <= 0) {
            throw new IllegalArgumentException("anchorId must be positive");
        }
    }

    public static DungeonLinkAnchor endpoint(long endpointId) {
        return new DungeonLinkAnchor(DungeonLinkAnchorType.ENDPOINT, endpointId);
    }

    public static DungeonLinkAnchor passage(long passageId) {
        return new DungeonLinkAnchor(DungeonLinkAnchorType.PASSAGE, passageId);
    }
}
