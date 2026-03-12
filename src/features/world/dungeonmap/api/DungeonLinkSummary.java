package features.world.dungeonmap.api;

public record DungeonLinkSummary(
        long linkId,
        String label,
        String fromName,
        String toName
) {}
