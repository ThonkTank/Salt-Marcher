package src.domain.dungeon.map;

/**
 * Empty authored room catalog placeholder for the first real map slice.
 */
public record RoomCatalog() {

    public static RoomCatalog empty() {
        return new RoomCatalog();
    }
}
