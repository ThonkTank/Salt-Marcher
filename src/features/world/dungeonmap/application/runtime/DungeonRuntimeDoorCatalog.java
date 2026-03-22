package features.world.dungeonmap.application.runtime;

import features.world.dungeonmap.application.room.RoomExitCatalog;
import features.world.dungeonmap.application.room.RoomExitDescriptor;
import features.world.dungeonmap.model.structures.room.Room;

import java.util.List;

public final class DungeonRuntimeDoorCatalog {

    private DungeonRuntimeDoorCatalog() {
        throw new AssertionError("No instances");
    }

    public static List<DungeonRuntimeDoorDescriptor> describe(Room room, DungeonHeading heading) {
        if (room == null) {
            return List.of();
        }
        return RoomExitCatalog.describe(room).stream()
                .map(exit -> toDescriptor(room, exit, heading))
                .toList();
    }

    private static DungeonRuntimeDoorDescriptor toDescriptor(Room room, RoomExitDescriptor exit, DungeonHeading heading) {
        String narration = room.narration().exitDescription(exit.roomCell(), exit.direction());
        return DungeonRuntimeDoorDescriptor.from(exit, heading, narration);
    }
}
