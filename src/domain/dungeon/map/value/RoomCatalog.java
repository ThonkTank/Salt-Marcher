package src.domain.dungeon.map.value;

import src.domain.dungeon.map.entity.DungeonRoom;

import java.util.ArrayList;
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
        return rooms.stream()
                .filter(room -> room.roomId() == roomId)
                .findFirst();
    }

    public RoomCatalog moveClusterRooms(long clusterId, int deltaQ, int deltaR) {
        if (clusterId <= 0L || (deltaQ == 0 && deltaR == 0)) {
            return this;
        }
        List<DungeonRoom> movedRooms = new ArrayList<>();
        boolean changed = false;
        for (DungeonRoom room : rooms) {
            if (room.clusterId() == clusterId) {
                movedRooms.add(room.movedBy(deltaQ, deltaR));
                changed = true;
            } else {
                movedRooms.add(room);
            }
        }
        return changed ? new RoomCatalog(movedRooms) : this;
    }
}
