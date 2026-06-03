package src.domain.dungeon.model.worldspace;

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
