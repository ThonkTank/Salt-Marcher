package src.domain.dungeon.model.core.model.structure;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

public record CorridorRoomSet(List<Long> roomIds) {

    public CorridorRoomSet {
        roomIds = normalized(roomIds);
    }

    @Override
    public List<Long> roomIds() {
        return List.copyOf(roomIds);
    }

    public boolean connects(long roomId) {
        return roomId > 0L && roomIds.contains(roomId);
    }

    public CorridorRoomSet withAdded(long roomId) {
        if (roomId <= 0L || roomIds.contains(roomId)) {
            return this;
        }
        Set<Long> updated = new LinkedHashSet<>(roomIds);
        updated.add(roomId);
        return new CorridorRoomSet(List.copyOf(updated));
    }

    private static List<Long> normalized(List<Long> roomIds) {
        Set<Long> result = new LinkedHashSet<>();
        for (Long roomId : roomIds == null ? List.<Long>of() : roomIds) {
            if (roomId != null && roomId > 0L) {
                result.add(roomId);
            }
        }
        return List.copyOf(result);
    }
}
