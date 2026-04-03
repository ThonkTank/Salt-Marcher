package features.world.dungeonmap.model.structures.room;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.structures.connection.DoorExitCatalog;
import features.world.dungeonmap.model.structures.connection.RoomExitDescriptor;

import java.util.List;

public final class RoomExitCatalog {

    private RoomExitCatalog() {
        throw new AssertionError("No instances");
    }

    public static List<RoomExitDescriptor> describe(DungeonLayout layout, Room room) {
        if (layout == null || room == null || room.roomId() == null) {
            return List.of();
        }
        return room.structure().levels().stream()
                .sorted()
                .flatMap(levelZ -> DoorExitCatalog.describe(
                        room.structure().cellCoordsAtLevel(levelZ),
                        levelZ,
                        layout.connectionsForRoom(room.roomId())).stream())
                .toList();
    }
}
