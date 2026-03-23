package features.world.dungeonmap.model.structures.cluster;

import features.world.dungeonmap.model.geometry.Point2i;

public record InternalBoundaryEdge(
        Point2i cell,
        Point2i direction,
        InternalBoundaryType type
) {
}
