package src.domain.dungeon.entity;

/**
 * Empty canonical spatial topology placeholder for the first real map slice.
 */
public record SpatialTopology() {

    public static SpatialTopology empty() {
        return new SpatialTopology();
    }
}
