package features.world.dungeonmap.model.structures.corridor;

import features.world.dungeonmap.model.geometry.Point2i;

import java.util.Objects;

/**
 * Relative corridor waypoint binding to a cluster center.
 */
public record CorridorWaypointBinding(
        long clusterId,
        Point2i relativeCell
) {
    public CorridorWaypointBinding {
        Objects.requireNonNull(relativeCell, "relativeCell");
    }

    public Point2i absoluteCell(Point2i clusterCenter) {
        return clusterCenter == null ? relativeCell : clusterCenter.add(relativeCell);
    }

    public CorridorWaypointBinding rebind(long clusterId, Point2i relativeCell) {
        return new CorridorWaypointBinding(clusterId, relativeCell);
    }
}
