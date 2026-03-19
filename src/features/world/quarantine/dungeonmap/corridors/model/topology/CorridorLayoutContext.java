package features.world.quarantine.dungeonmap.corridors.model.topology;

import features.world.quarantine.dungeonmap.foundation.geometry.Point2i;
import features.world.quarantine.dungeonmap.layout.model.DungeonLayout;
import features.world.quarantine.dungeonmap.rooms.model.DungeonRoom;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

public record CorridorLayoutContext(
        Map<Long, DungeonRoom> roomsById,
        Map<Long, Set<Point2i>> roomCellsById,
        Map<Point2i, Long> roomOccupancy
) {

    public static CorridorLayoutContext from(DungeonLayout layout) {
        Map<Long, DungeonRoom> roomsById = roomsById(layout.rooms());
        Map<Long, Set<Point2i>> roomCellsById = new LinkedHashMap<>();
        Map<Point2i, Long> roomOccupancy = new HashMap<>();
        for (DungeonRoom room : layout.rooms()) {
            Set<Point2i> roomCells = layout.roomCells(room.roomId());
            roomCellsById.put(room.roomId(), roomCells);
            for (Point2i cell : roomCells) {
                roomOccupancy.put(cell, room.roomId());
            }
        }
        return new CorridorLayoutContext(Map.copyOf(roomsById), immutableSetMap(roomCellsById), Map.copyOf(roomOccupancy));
    }

    private static Map<Long, Set<Point2i>> immutableSetMap(Map<Long, Set<Point2i>> source) {
        Map<Long, Set<Point2i>> copy = new LinkedHashMap<>();
        for (Map.Entry<Long, Set<Point2i>> entry : source.entrySet()) {
            copy.put(entry.getKey(), Set.copyOf(entry.getValue()));
        }
        return Map.copyOf(copy);
    }

    private static Map<Long, DungeonRoom> roomsById(List<DungeonRoom> rooms) {
        Map<Long, DungeonRoom> result = new HashMap<>();
        for (DungeonRoom room : rooms) {
            if (room.roomId() != null) {
                result.put(room.roomId(), room);
            }
        }
        return result;
    }
}
