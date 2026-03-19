package features.world.quarantine.dungeonmap.corridors.model.binding;

import features.world.quarantine.dungeonmap.foundation.geometry.Point2i;

public interface ClusterBoundBinding<T> {
    long clusterId();
    Point2i absoluteCell(Point2i center);
    T rebuild(long clusterId, Point2i relativeCell);
}
