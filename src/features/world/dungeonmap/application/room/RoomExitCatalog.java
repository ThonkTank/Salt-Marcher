package features.world.dungeonmap.application.room;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.structures.room.Room;

import java.util.List;

public final class RoomExitCatalog {

    private RoomExitCatalog() {
        throw new AssertionError("No instances");
    }

    public static List<RoomExitDescriptor> describe(DungeonLayout layout, Room room) {
        if (layout == null || room == null || room.roomId() == null) {
            return List.of();
        }
        return DoorExitCatalog.describe(room.cells(), layout.doorsForRoom(room.roomId()));
    }
}
