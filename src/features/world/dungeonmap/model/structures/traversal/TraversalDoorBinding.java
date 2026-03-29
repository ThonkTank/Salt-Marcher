package features.world.dungeonmap.model.structures.traversal;

import features.world.dungeonmap.model.geometry.Point2i;

import java.util.Objects;

/**
 * Relative traversal door binding pinned to one room edge.
 */
public record TraversalDoorBinding(
        long roomId,
        long clusterId,
        Point2i relativeCell,
        Point2i direction
) {
    public TraversalDoorBinding {
        Objects.requireNonNull(relativeCell, "relativeCell");
        Objects.requireNonNull(direction, "direction");
    }

    public Point2i absoluteCell(Point2i clusterCenter) {
        return clusterCenter == null ? relativeCell : clusterCenter.add(relativeCell);
    }

    public static TraversalDoorBinding atAbsoluteCell(
            long roomId,
            long clusterId,
            Point2i absoluteCell,
            Point2i clusterCenter,
            Point2i direction
    ) {
        Point2i resolvedAbsoluteCell = Objects.requireNonNull(absoluteCell, "absoluteCell");
        Point2i resolvedCenter = clusterCenter == null ? new Point2i(0, 0) : clusterCenter;
        return new TraversalDoorBinding(roomId, clusterId, resolvedAbsoluteCell.subtract(resolvedCenter), direction);
    }

    public TraversalDoorBinding rebind(long clusterId, Point2i relativeCell) {
        return new TraversalDoorBinding(roomId, clusterId, relativeCell, direction);
    }
}
