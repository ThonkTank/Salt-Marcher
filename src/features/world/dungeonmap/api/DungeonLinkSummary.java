package features.world.dungeonmap.api;

public record DungeonLinkSummary(
        long linkId,
        String label,
        String fromAnchorName,
        String toAnchorName
) {}
