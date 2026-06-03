package src.domain.dungeon.model.worldspace;


import java.util.List;
import java.util.Optional;

/**
 * Authored rooms loaded from the dungeon write model.
 */
public record RoomCatalog(
        List<DungeonRoom> rooms
) {

    public RoomCatalog {
        rooms = rooms == null ? List.of() : List.copyOf(rooms);
    }

    public static RoomCatalog empty() {
        return new RoomCatalog(List.of());
    }

    public Optional<DungeonRoom> findRoom(long roomId) {
        for (DungeonRoom room : rooms) {
            if (room != null && room.roomId() == roomId) {
                return Optional.of(room);
            }
        }
        return Optional.empty();
    }

}
