package features.world.dungeonmap.application.runtime;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.model.structures.transition.DungeonTransition;

import java.util.stream.Stream;

public final class DungeonRuntimeLabels {

    private DungeonRuntimeLabels() {
    }

    public static String activeLocationLabel(DungeonLayout layout, CellCoord cell, int levelZ) {
        return structureLabelAtCell(layout, cell, levelZ);
    }

    public static String cellLabel(CellCoord cell, int levelZ) {
        return cell == null ? "\u2014" : cell.x() + ", " + cell.y() + ", z=" + levelZ;
    }

    public static String headingLabel(CardinalDirection heading) {
        CardinalDirection resolved = heading == null ? CardinalDirection.defaultDirection() : heading;
        return resolved.label();
    }

    public static String structureLabelAtCell(DungeonLayout layout, CellCoord cell, int levelZ) {
        if (layout == null || cell == null) {
            return "Kein Standort";
        }
        DungeonLayout.CellStructure structure = layout.structureAtCell(cell, levelZ);
        if (structure instanceof DungeonLayout.CellStructure.RoomStructure roomStructure) {
            return roomLabel(roomStructure.room());
        }
        if (structure instanceof DungeonLayout.CellStructure.CorridorStructure corridorStructure) {
            return corridorLabel(layout, corridorStructure.corridor());
        }
        var stair = layout.stairsAtCell(cell, levelZ).stream().findFirst().orElse(null);
        if (stair != null) {
            return stair.label();
        }
        DungeonTransition transition = layout.transitionsAtCell(cell, levelZ).stream().findFirst().orElse(null);
        if (transition != null) {
            return transition.label();
        }
        return "Kein Standort";
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

    public static Room roomAtCell(DungeonLayout layout, CellCoord cell, int levelZ) {
        if (layout == null || cell == null) {
            return null;
        }
        return layout.roomAtCell(cell, levelZ);
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
