package src.domain.dungeon.model.map.model;

/**
 * Authored spatial stair truth owned by SpatialTopology.
 * Future stair geometry fields stay here, not in connection metadata.
 */
public record StairPlacement(
        int startFloor,
        int endFloor,
        int q,
        int r
) {
}
