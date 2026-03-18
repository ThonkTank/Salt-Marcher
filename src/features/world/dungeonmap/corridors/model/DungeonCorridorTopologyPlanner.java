package features.world.dungeonmap.corridors.model;
import features.world.dungeonmap.foundation.geometry.Point2i;

import features.world.dungeonmap.layout.model.DungeonLayout;
import features.world.dungeonmap.rooms.model.*;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

public final class DungeonCorridorTopologyPlanner {

    private DungeonCorridorTopologyPlanner() {
        throw new AssertionError("No instances");
    }

    public static CorridorTopology planCorridorTopology(DungeonLayout layout) {
        return planCorridorTopology(layout, buildLayoutContext(layout));
    }

    public static CorridorTopology planCorridorTopology(DungeonLayout layout, LayoutContext context) {
        if (layout == null) {
            return new CorridorTopology(Map.of(), Map.of(), Map.of());
        }
        LayoutContext resolvedContext = context == null ? buildLayoutContext(layout) : context;

        Map<Long, CorridorGeometry> result = new LinkedHashMap<>();
        for (DungeonCorridor corridor : layout.corridors()) {
            List<DungeonRoom> corridorRooms = resolveCorridorRooms(corridor, resolvedContext);
            result.put(corridor.corridorId(), CorridorRoutePlanner.planCorridorGeometry(
                    layout,
                    corridor,
                    corridorRooms,
                    resolvedContext.roomCellsById(),
                    resolvedContext.roomOccupancy()));
        }
        return CorridorTopologyBuilder.build(layout, result);
    }

    public static LayoutContext buildLayoutContext(DungeonLayout layout) {
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
        return new LayoutContext(Map.copyOf(roomsById), immutableSetMap(roomCellsById), Map.copyOf(roomOccupancy));
    }

    public static CorridorGeometry planCorridorGeometry(DungeonLayout layout, DungeonCorridor corridor) {
        return planCorridorGeometry(layout, corridor, buildLayoutContext(layout));
    }

    public static CorridorGeometry planCorridorGeometry(DungeonLayout layout, DungeonCorridor corridor, LayoutContext context) {
        if (layout == null || corridor == null || context == null) {
            return null;
        }
        List<DungeonRoom> corridorRooms = resolveCorridorRooms(corridor, context);
        return CorridorRoutePlanner.planCorridorGeometry(layout, corridor, corridorRooms, context.roomCellsById(), context.roomOccupancy());
    }

    private static List<DungeonRoom> resolveCorridorRooms(DungeonCorridor corridor, LayoutContext context) {
        return corridor.roomIds().stream()
                .map(context.roomsById()::get)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
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

    public record LayoutContext(
            Map<Long, DungeonRoom> roomsById,
            Map<Long, Set<Point2i>> roomCellsById,
            Map<Point2i, Long> roomOccupancy
    ) {
    }
}
