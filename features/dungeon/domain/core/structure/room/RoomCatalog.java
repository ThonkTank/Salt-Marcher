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
        List<RoomRegion> rooms
) {

    public RoomCatalog {
        rooms = rooms == null ? List.of() : List.copyOf(rooms);
    }

    public static RoomCatalog empty() {
        return new RoomCatalog(List.of());
    }

    public Optional<RoomRegion> findRoom(long roomId) {
        for (RoomRegion room : rooms) {
            if (room != null && room.roomId() == roomId) {
                return Optional.of(room);
            }
        }
        return Optional.empty();
    }

    public List<RoomRegion> roomsInCluster(long clusterId) {
        List<RoomRegion> result = new ArrayList<>();
        for (RoomRegion room : rooms) {
            if (room != null && room.clusterId() == clusterId) {
                result.add(room);
            }
        }
        return List.copyOf(result);
    }

    public Map<Long, List<RoomRegion>> roomsByCluster() {
        Map<Long, List<RoomRegion>> result = new LinkedHashMap<>();
        for (RoomRegion room : rooms) {
            if (room != null) {
                result.computeIfAbsent(room.clusterId(), unused -> new ArrayList<>()).add(room);
            }
        }
        Map<Long, List<RoomRegion>> copied = new LinkedHashMap<>();
        for (Map.Entry<Long, List<RoomRegion>> entry : result.entrySet()) {
            copied.put(entry.getKey(), List.copyOf(entry.getValue()));
        }
        return Map.copyOf(copied);
    }

    public long nextRoomId() {
        long result = 0L;
        for (RoomRegion room : rooms) {
            if (room != null && room.roomId() > result) {
                result = room.roomId();
            }
        }
        return result + 1L;
    }

}
