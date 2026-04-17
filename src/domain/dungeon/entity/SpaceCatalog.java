package src.domain.dungeon.entity;

/**
 * Empty authored space catalog placeholder for the first real map slice.
 */
public record SpaceCatalog() {

    public static SpaceCatalog empty() {
        return new SpaceCatalog();
    }
}
