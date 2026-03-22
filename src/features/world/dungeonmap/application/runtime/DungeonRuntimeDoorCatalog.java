package features.world.dungeonmap.application.runtime;

import features.world.dungeonmap.application.room.DoorExitCatalog;
import features.world.dungeonmap.application.room.RoomExitCatalog;
import features.world.dungeonmap.application.room.RoomExitDescriptor;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.corridor.CorridorNetwork;
import features.world.dungeonmap.model.structures.room.Room;

import java.util.List;
import java.util.function.BiFunction;

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

    public static List<DungeonRuntimeDoorDescriptor> describe(Corridor corridor, DungeonHeading heading) {
        if (corridor == null || corridor.path() == null) {
            return List.of();
        }
        return describe(corridor.path().floor().shape().absoluteCells(), corridor.path().doors(), heading, (cell, direction) -> "");
    }

    public static List<DungeonRuntimeDoorDescriptor> describe(CorridorNetwork network, DungeonHeading heading) {
        if (network == null || network.floor() == null) {
            return List.of();
        }
        return describe(network.floor().shape().absoluteCells(), network.doors(), heading, (cell, direction) -> "");
    }

    private static List<DungeonRuntimeDoorDescriptor> describe(
            java.util.Set<features.world.dungeonmap.model.geometry.Point2i> cells,
            java.util.List<features.world.dungeonmap.model.objects.Door> doors,
            DungeonHeading heading,
            BiFunction<features.world.dungeonmap.model.geometry.Point2i, features.world.dungeonmap.model.geometry.Point2i, String> narrationLookup
    ) {
        return DoorExitCatalog.describe(cells, doors).stream()
                .map(exit -> toDescriptor(exit, heading, narrationLookup == null ? "" : narrationLookup.apply(exit.roomCell(), exit.direction())))
                .toList();
    }

    private static DungeonRuntimeDoorDescriptor toDescriptor(Room room, RoomExitDescriptor exit, DungeonHeading heading) {
        String narration = room.narration().exitDescription(exit.roomCell(), exit.direction());
        return toDescriptor(exit, heading, narration);
    }

    private static DungeonRuntimeDoorDescriptor toDescriptor(RoomExitDescriptor exit, DungeonHeading heading, String narration) {
        return DungeonRuntimeDoorDescriptor.from(exit, heading, narration);
    }
}
