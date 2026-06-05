package src.domain.dungeon.model.core.graph;

import src.domain.dungeon.model.core.geometry.Cell;

public record DungeonTraversalEndpoint(
        Cell tile,
        long areaId,
        String areaLabel
) {

    public DungeonTraversalEndpoint {
        tile = tile == null ? new Cell(0, 0, 0) : tile;
        areaId = Math.max(0L, areaId);
        areaLabel = areaLabel == null ? "" : areaLabel.trim();
    }
}
