package src.domain.dungeon.model.worldspace;

import java.util.List;
import java.util.Optional;
import src.domain.dungeon.model.core.structure.room.DungeonRoomNarration;
import src.domain.dungeon.model.core.structure.room.Room;

final class DungeonRoomClusterRoomRebuildLogic {
    List<DungeonRoom> roomsFor(DungeonRoomTopologyClusterWork work) {
        Optional<Room> rebuilt = work.toCore().rebuiltRoom();
        if (rebuilt.isEmpty()) {
            return List.of();
        }
        Room room = rebuilt.get();
        return List.of(DungeonRoom.fromCore(room, narrationFor(work, room.roomId())));
    }

    private static DungeonRoomNarration narrationFor(DungeonRoomTopologyClusterWork work, long roomId) {
        for (DungeonRoom room : work.rooms()) {
            if (room != null && room.roomId() == roomId) {
                return room.narration();
            }
        }
        return DungeonRoomNarration.empty();
    }
}
