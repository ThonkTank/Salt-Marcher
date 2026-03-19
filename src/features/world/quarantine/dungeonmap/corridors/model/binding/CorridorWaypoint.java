package features.world.quarantine.dungeonmap.corridors.model.binding;

import features.world.quarantine.dungeonmap.foundation.geometry.Point2i;

import java.util.Objects;

public record CorridorWaypoint(
        long clusterId,
        Point2i relativeCell
) implements ClusterBoundBinding<CorridorWaypoint> {
    public CorridorWaypoint {
        Objects.requireNonNull(relativeCell, "relativeCell");
    }

    @Override
    public Point2i absoluteCell(Point2i clusterCenter) {
        return clusterCenter == null ? relativeCell : clusterCenter.add(relativeCell);
    }

    @Override
    public CorridorWaypoint rebuild(long clusterId, Point2i relativeCell) {
        return new CorridorWaypoint(clusterId, relativeCell);
    }
}
