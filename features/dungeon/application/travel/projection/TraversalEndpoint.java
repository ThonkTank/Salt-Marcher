package features.dungeon.application.travel.projection;


import features.dungeon.domain.core.geometry.Cell;

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
