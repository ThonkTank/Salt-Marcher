package src.domain.dungeon.model.map.model;

/**
 * Empty authored space catalog placeholder for the first real map slice.
 */
public final class SpaceCatalog {
    private static final SpaceCatalog EMPTY = new SpaceCatalog();

    private SpaceCatalog() {
    }

    public static SpaceCatalog empty() {
        return EMPTY;
    }
}
