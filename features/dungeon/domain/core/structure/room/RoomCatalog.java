package features.dungeon.domain.core.structure.room;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
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

    public List<DungeonRoom> roomsInCluster(long clusterId) {
        List<DungeonRoom> result = new ArrayList<>();
        for (DungeonRoom room : rooms) {
            if (room != null && room.clusterId() == clusterId) {
                result.add(room);
            }
        }
        return List.copyOf(result);
    }

    public Map<Long, List<DungeonRoom>> roomsByCluster() {
        Map<Long, List<DungeonRoom>> result = new LinkedHashMap<>();
        for (DungeonRoom room : rooms) {
            if (room != null) {
                result.computeIfAbsent(room.clusterId(), unused -> new ArrayList<>()).add(room);
            }
        }
        Map<Long, List<DungeonRoom>> copied = new LinkedHashMap<>();
        for (Map.Entry<Long, List<DungeonRoom>> entry : result.entrySet()) {
            copied.put(entry.getKey(), List.copyOf(entry.getValue()));
        }
        return Map.copyOf(copied);
    }

    public long nextRoomId() {
        long result = 0L;
        for (DungeonRoom room : rooms) {
            if (room != null && room.roomId() > result) {
                result = room.roomId();
            }
        }
        return result + 1L;
    }

}
