package src.domain.dungeon.valueobject;

/**
 * Authored spatial stair truth owned by SpatialTopology.
 * Future stair geometry fields stay here, not in connection metadata.
 */
public record StairPlacement(
        int startFloor,
        int endFloor,
        int q,
        int r
) implements MapPlacement {
}
