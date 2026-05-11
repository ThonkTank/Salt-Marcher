package src.domain.dungeon.model.map.model;

/**
 * Empty authored feature catalog placeholder for the first real map slice.
 */
public final class FeatureCatalog {
    private static final FeatureCatalog EMPTY = new FeatureCatalog();

    private FeatureCatalog() {
    }

    public static FeatureCatalog empty() {
        return EMPTY;
    }
}
