package features.world.dungeonmap.application.runtime;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.room.Room;

import java.util.stream.Stream;

public final class DungeonRuntimeLabels {

    private DungeonRuntimeLabels() {
    }

    public static String cellLabel(CellCoord cell, int levelZ) {
        return cell == null ? "\u2014" : cell.x() + ", " + cell.y() + ", z=" + levelZ;
    }

    public static String headingLabel(CardinalDirection heading) {
        CardinalDirection resolved = heading == null ? CardinalDirection.defaultDirection() : heading;
        return resolved.label();
    }

    public static String roomLabel(DungeonLayout layout, Long roomId) {
        Room room = roomForId(layout, roomId);
        if (room == null) {
            return roomId == null ? "Raum" : "Raum " + roomId;
        }
        return roomLabel(room);
    }

    public static String roomLabel(Room room) {
        if (room == null) {
            return "Raum";
        }
        return room.name() == null || room.name().isBlank() ? "Raum " + room.roomId() : room.name();
    }

    public static String corridorLabel(DungeonLayout layout, Corridor corridor) {
        if (corridor == null) {
            return "Korridor";
        }
        return corridorLabel(layout, corridor.connectedRoomIds().stream());
    }

    private static Room roomForId(DungeonLayout layout, Long roomId) {
        return layout == null ? null : layout.findRoom(roomId);
    }

    private static String corridorLabel(DungeonLayout layout, Stream<Long> roomIds) {
        String joinedRooms = roomIds
                .map(roomId -> roomLabel(layout, roomId))
                .distinct()
                .sorted(String::compareToIgnoreCase)
                .reduce((left, right) -> left + ", " + right)
                .orElse("Korridor");
        return "Korridor: " + joinedRooms;
    }
}
