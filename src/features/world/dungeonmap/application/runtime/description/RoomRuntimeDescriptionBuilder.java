package features.world.dungeonmap.application.runtime.description;

import features.world.dungeonmap.application.runtime.DungeonRuntimeLocation;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.structures.room.Room;

import java.util.List;

final class RoomRuntimeDescriptionBuilder {

    private RoomRuntimeDescriptionBuilder() {
        throw new AssertionError("No instances");
    }

    static DungeonRuntimeDescription build(DungeonRuntimeLocation location) {
        DungeonLayout layout = location == null ? null : location.layout();
        Room room = location == null ? null : location.room();
        if (layout == null || room == null || room.roomId() == null) {
            return null;
        }
        List<DungeonRuntimeExit> exits = layout.describeRoomExits(room).stream()
                .map(exit -> DungeonRuntimeExitFactory.roomExit(location, exit))
                .filter(java.util.Objects::nonNull)
                .toList();
        return new DungeonRuntimeDescription(
                roomLabel(room),
                location.ownerRef(),
                room.narration().visualDescription(),
                exits);
    }

    private static String roomLabel(Room room) {
        if (room == null) {
            return "Raum";
        }
        return room.name() == null || room.name().isBlank() ? "Raum " + room.roomId() : room.name();
    }
}
