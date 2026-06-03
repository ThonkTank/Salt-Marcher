package src.domain.dungeon.model.runtime.travel.projection;


import src.domain.dungeon.model.core.geometry.Cell;

public record TraversalEndpoint(
        Cell tile,
        long areaId,
        String areaLabel
) {

    public TraversalEndpoint {
        tile = tile == null ? new Cell(0, 0, 0) : tile;
        areaId = Math.max(0L, areaId);
        areaLabel = areaLabel == null ? "" : areaLabel.trim();
    }
}
