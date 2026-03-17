package features.world.dungeonmap.domain.model;

import java.util.Objects;

public record CorridorWaypoint(
        long clusterId,
        Point2i relativeCell
) {
    public CorridorWaypoint {
        Objects.requireNonNull(relativeCell, "relativeCell");
    }

    public Point2i absoluteCell(Point2i clusterCenter) {
        return clusterCenter == null ? relativeCell : clusterCenter.add(relativeCell);
    }
}
