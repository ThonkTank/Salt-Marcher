package src.domain.dungeon.map.value;

/**
 * Empty canonical spatial topology placeholder for the first real map slice.
 */
public record SpatialTopology() {

    public static SpatialTopology empty() {
        return new SpatialTopology();
    }
}
