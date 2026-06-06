package src.domain.dungeon.model.core.structure.room;

import java.util.List;
import java.util.Optional;
import src.domain.dungeon.model.worldspace.DungeonRoom;

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

    public List<RoomTopologyEntry> topologyEntries() {
        List<RoomTopologyEntry> result = new java.util.ArrayList<>();
        for (DungeonRoom room : rooms) {
            if (room != null) {
                result.add(new RoomTopologyEntry(room.roomId(), room.clusterId(), room.name()));
            }
        }
        return List.copyOf(result);
    }

    public record RoomTopologyEntry(
            long roomId,
            long clusterId,
            String name
    ) {
        public RoomTopologyEntry {
            roomId = Math.max(0L, roomId);
            clusterId = Math.max(0L, clusterId);
            name = name == null ? "" : name.trim();
        }
    }
}
