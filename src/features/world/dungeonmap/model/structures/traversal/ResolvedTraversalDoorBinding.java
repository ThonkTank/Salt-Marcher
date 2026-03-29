package features.world.dungeonmap.model.structures.traversal;

import features.world.dungeonmap.model.geometry.Point2i;

/**
 * Runtime-resolved absolute door binding for one traversal endpoint.
 */
public record ResolvedTraversalDoorBinding(Point2i absoluteCell, Point2i direction) {
}
