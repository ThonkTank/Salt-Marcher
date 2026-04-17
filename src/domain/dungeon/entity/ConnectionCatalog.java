package src.domain.dungeon.entity;

/**
 * Empty authored connection catalog placeholder for the first real map slice.
 */
public record ConnectionCatalog() {

    public static ConnectionCatalog empty() {
        return new ConnectionCatalog();
    }
}
