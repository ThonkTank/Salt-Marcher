package src.domain.dungeon.map.value;

/**
 * Empty authored feature catalog placeholder for the first real map slice.
 */
public record FeatureCatalog() {

    public static FeatureCatalog empty() {
        return new FeatureCatalog();
    }
}
