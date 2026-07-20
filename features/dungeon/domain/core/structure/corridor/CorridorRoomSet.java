package features.dungeon.domain.core.structure.corridor;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

public record CorridorRoomSet(List<Long> roomIds) {
    private static final long MISSING_ROOM_ID = 0L;

    public CorridorRoomSet {
        roomIds = normalized(roomIds);
    }

    @Override
    public List<Long> roomIds() {
        return List.copyOf(roomIds);
    }

    public boolean connects(long roomId) {
        return roomId > MISSING_ROOM_ID && roomIds.contains(roomId);
    }

    public CorridorRoomSet withAdded(long roomId) {
        if (roomId <= MISSING_ROOM_ID || roomIds.contains(roomId)) {
            return this;
        }
        Set<Long> updated = new LinkedHashSet<>(roomIds);
        updated.add(roomId);
        return new CorridorRoomSet(List.copyOf(updated));
    }

    public CorridorRoomSet without(long roomId) {
        if (roomId <= MISSING_ROOM_ID || !roomIds.contains(roomId)) {
            return this;
        }
        Set<Long> updated = new LinkedHashSet<>(roomIds);
        updated.remove(roomId);
        return new CorridorRoomSet(List.copyOf(updated));
    }

    private static List<Long> normalized(List<Long> roomIds) {
        Set<Long> result = new LinkedHashSet<>();
        for (Long roomId : roomIds == null ? List.<Long>of() : roomIds) {
            if (roomId != null && roomId > MISSING_ROOM_ID) {
                result.add(roomId);
            }
        }
        return List.copyOf(result);
    }
}
