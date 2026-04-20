package src.domain.dungeon.map.value;

/**
 * Empty authored space catalog placeholder for the first real map slice.
 */
public record SpaceCatalog() {

    public static SpaceCatalog empty() {
        return new SpaceCatalog();
    }
}
