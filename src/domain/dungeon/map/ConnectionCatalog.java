package src.domain.dungeon.map;

/**
 * Empty authored connection catalog placeholder for the first real map slice.
 */
public record ConnectionCatalog() {

    public static ConnectionCatalog empty() {
        return new ConnectionCatalog();
    }
}
