package src.domain.dungeon.model.worldspace.model;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

final class DungeonCorridorRoomIds {
    private DungeonCorridorRoomIds() {
    }

    static List<Long> normalized(List<Long> roomIds) {
        Set<Long> result = new LinkedHashSet<>();
        for (Long roomId : roomIds == null ? List.<Long>of() : roomIds) {
            if (roomId != null && roomId > 0L) {
                result.add(roomId);
            }
        }
        return List.copyOf(result);
    }
}
