package features.world.dungeonmap.model.structures.corridor;

import features.world.dungeonmap.model.geometry.Point2i;

/**
 * Runtime-resolved absolute door binding for one corridor endpoint.
 */
public record ResolvedCorridorDoorBinding(Point2i absoluteCell, Point2i direction) {
}
