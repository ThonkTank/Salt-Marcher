package src.domain.dungeon.model.core.graph;

import src.domain.dungeon.model.worldspace.DungeonCell;

public record DungeonTraversalEndpoint(
        DungeonCell tile,
        long areaId,
        String areaLabel
) {

    public DungeonTraversalEndpoint {
        tile = tile == null ? new DungeonCell(0, 0, 0) : tile;
        areaId = Math.max(0L, areaId);
        areaLabel = areaLabel == null ? "" : areaLabel.trim();
    }
}
