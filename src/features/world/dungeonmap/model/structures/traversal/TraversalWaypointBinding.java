package features.world.dungeonmap.model.structures.traversal;

import features.world.dungeonmap.model.geometry.Point2i;

import java.util.Objects;

/**
 * Relative traversal waypoint binding to a cluster center.
 */
public record TraversalWaypointBinding(
        long clusterId,
        Point2i relativeCell,
        int levelZ
) {
    public TraversalWaypointBinding {
        Objects.requireNonNull(relativeCell, "relativeCell");
    }

    public Point2i absoluteCell(Point2i clusterCenter) {
        return clusterCenter == null ? relativeCell : clusterCenter.add(relativeCell);
    }

    public static TraversalWaypointBinding atAbsoluteCell(long clusterId, Point2i absoluteCell, Point2i clusterCenter, int levelZ) {
        Point2i resolvedAbsoluteCell = Objects.requireNonNull(absoluteCell, "absoluteCell");
        Point2i resolvedCenter = clusterCenter == null ? new Point2i(0, 0) : clusterCenter;
        return new TraversalWaypointBinding(clusterId, resolvedAbsoluteCell.subtract(resolvedCenter), levelZ);
    }

    public TraversalWaypointBinding rebind(long clusterId, Point2i relativeCell) {
        return new TraversalWaypointBinding(clusterId, relativeCell, levelZ);
    }
}
