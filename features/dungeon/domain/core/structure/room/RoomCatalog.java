package features.dungeon.domain.core.structure.room;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import org.jspecify.annotations.Nullable;

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

    public RoomCatalog withExactChange(
            @Nullable RoomRegion before,
            @Nullable RoomRegion after
    ) {
        RoomRegion identity = after == null ? before : after;
        if (identity == null) {
            throw new IllegalArgumentException("room change requires identity");
        }
        RoomRegion current = findRoom(identity.roomId()).orElse(null);
        if (!Objects.equals(current, before)) {
            throw new IllegalStateException("room patch does not match current authored truth");
        }
        List<RoomRegion> nextRooms = new ArrayList<>();
        for (RoomRegion room : rooms) {
            if (room.roomId() == identity.roomId()) {
                if (after != null) {
                    nextRooms.add(after);
                }
            } else {
                nextRooms.add(room);
            }
        }
        if (before == null && after != null) {
            nextRooms.add(after);
        }
        return new RoomCatalog(nextRooms);
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

}
