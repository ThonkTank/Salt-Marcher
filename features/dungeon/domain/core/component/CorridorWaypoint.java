package features.dungeon.domain.core.component;

import java.util.Objects;
import features.dungeon.domain.core.geometry.Cell;

public record CorridorWaypoint(
        long clusterId,
        Cell relativeCell,
        int level
) {

    public CorridorWaypoint {
        clusterId = Math.max(0L, clusterId);
        Objects.requireNonNull(relativeCell);
    }

    public Cell absoluteCell(Cell clusterCenter) {
        Objects.requireNonNull(clusterCenter);
        return new Cell(
                clusterCenter.q() + relativeCell.q(),
                clusterCenter.r() + relativeCell.r(),
                level);
    }
}
