package features.world.dungeonmap.canvas.graph;

import features.world.dungeonmap.model.structures.corridor.Corridor;

import java.util.ArrayList;
import java.util.List;

final class DungeonGraphProjection {

    private DungeonGraphProjection() {
    }

    static List<RoomLink> roomLinks(Corridor corridor) {
        if (corridor == null) {
            return List.of();
        }
        List<RoomLink> links = new ArrayList<>();
        List<Long> roomIds = corridor.roomIds();
        for (int index = 1; index < roomIds.size(); index++) {
            Long fromRoomId = roomIds.get(index - 1);
            Long toRoomId = roomIds.get(index);
            if (fromRoomId == null || toRoomId == null || fromRoomId.equals(toRoomId)) {
                continue;
            }
            links.add(new RoomLink(fromRoomId, toRoomId));
        }
        return List.copyOf(links);
    }

    record RoomLink(long fromRoomId, long toRoomId) {
    }
}
