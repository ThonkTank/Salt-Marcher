package features.world.dungeonmap.model.structures.corridor.planning;

import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.structures.corridor.ResolvedCorridorDoorBinding;
import features.world.dungeonmap.model.structures.room.Room;

import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

final class PlannerContext {

    private final List<Room> targetRooms;
    private final Map<Long, Room> targetRoomsById;
    private final Map<Long, Integer> roomLevels;
    private final Map<Long, ResolvedCorridorDoorBinding> doorBindings;
    private final List<CubePoint> waypointCells;
    private final SearchVolume searchVolume;
    private final PlannerInstrumentation instrumentation;
    private final Map<Long, Set<CubePoint>> entryCellsByRoomId;
    private final Map<CubePoint, Long> roomIdByEntryCell;

    PlannerContext(
            List<Room> targetRooms,
            Map<Long, Integer> roomLevels,
            Set<CubePoint> allObstacles,
            List<CubePoint> waypointCells,
            Map<Long, ResolvedCorridorDoorBinding> doorBindings,
            PlannerInstrumentation instrumentation
    ) {
        this.targetRooms = targetRooms == null ? List.of() : List.copyOf(targetRooms);
        this.targetRoomsById = indexRoomsById(this.targetRooms);
        this.roomLevels = roomLevels == null ? Map.of() : Map.copyOf(roomLevels);
        this.doorBindings = doorBindings == null ? Map.of() : Map.copyOf(doorBindings);
        this.waypointCells = waypointCells == null ? List.of() : List.copyOf(waypointCells);
        this.instrumentation = instrumentation;
        this.searchVolume = SearchVolume.enclosing(allObstacles, this.targetRooms, this.roomLevels, this.waypointCells);
        this.entryCellsByRoomId = computeEntryCells(
                this.targetRooms,
                this.roomLevels,
                this.doorBindings,
                searchVolume,
                instrumentation);
        this.roomIdByEntryCell = indexRoomIdByEntryCell(entryCellsByRoomId);
    }

    List<Room> targetRooms() {
        return targetRooms;
    }

    List<CubePoint> waypointCells() {
        return waypointCells;
    }

    SearchVolume searchVolume() {
        return searchVolume;
    }

    PlannerInstrumentation instrumentation() {
        return instrumentation;
    }

    Room room(Long roomId) {
        return roomId == null ? null : targetRoomsById.get(roomId);
    }

    Set<CubePoint> entryCells(Long roomId) {
        if (roomId == null) {
            return Set.of();
        }
        return entryCellsByRoomId.getOrDefault(roomId, Set.of());
    }

    Set<CubePoint> allTargetEntryCells(Set<Long> excludeRoomIds) {
        Set<Long> excluded = excludeRoomIds == null ? Set.of() : Set.copyOf(excludeRoomIds);
        Set<CubePoint> result = new LinkedHashSet<>();
        for (Room room : targetRooms) {
            if (room == null || room.roomId() == null || excluded.contains(room.roomId())) {
                continue;
            }
            result.addAll(entryCells(room.roomId()));
        }
        return Set.copyOf(result);
    }

    int roomLevel(Long roomId) {
        return roomId == null ? 0 : roomLevels.getOrDefault(roomId, 0);
    }

    Long roomIdAtEntryCell(CubePoint entryCell) {
        return entryCell == null ? null : roomIdByEntryCell.get(entryCell);
    }

    Map<CubePoint, Long> targetRoomsByEntryCell(Set<CubePoint> entryCells) {
        if (entryCells == null || entryCells.isEmpty()) {
            return Map.of();
        }
        Map<CubePoint, Long> result = new LinkedHashMap<>();
        for (CubePoint entryCell : entryCells) {
            Long roomId = roomIdAtEntryCell(entryCell);
            if (roomId != null) {
                result.put(entryCell, roomId);
            }
        }
        return Map.copyOf(result);
    }

    private static Map<Long, Room> indexRoomsById(List<Room> rooms) {
        Map<Long, Room> result = new LinkedHashMap<>();
        for (Room room : rooms == null ? List.<Room>of() : rooms) {
            if (room != null && room.roomId() != null) {
                result.put(room.roomId(), room);
            }
        }
        return Map.copyOf(result);
    }

    private static Map<Long, Set<CubePoint>> computeEntryCells(
            List<Room> targetRooms,
            Map<Long, Integer> roomLevels,
            Map<Long, ResolvedCorridorDoorBinding> doorBindings,
            SearchVolume searchVolume,
            PlannerInstrumentation instrumentation
    ) {
        Map<Long, Set<CubePoint>> result = new LinkedHashMap<>();
        boolean allowVerticalEntries = searchVolume.minZ() < searchVolume.maxZ();
        for (Room room : targetRooms == null ? List.<Room>of() : targetRooms) {
            if (room == null || room.roomId() == null) {
                continue;
            }
            int roomLevel = roomLevels == null ? 0 : roomLevels.getOrDefault(room.roomId(), 0);
            Set<CubePoint> entryCells = new LinkedHashSet<>();
            ResolvedCorridorDoorBinding binding = doorBindings == null ? null : doorBindings.get(room.roomId());
            if (binding != null && binding.absoluteCell() != null && binding.direction() != null) {
                CubePoint boundEntry = CubePoint.at(binding.absoluteCell().add(binding.direction()), roomLevel);
                if (isValidEntry(boundEntry, searchVolume)) {
                    entryCells.add(boundEntry);
                }
            } else {
                for (Point2i roomCell : room.cells()) {
                    for (Point2i step : Point2i.CARDINAL_STEPS) {
                        Point2i outsideCell = roomCell.add(step);
                        if (room.cells().contains(outsideCell)) {
                            continue;
                        }
                        CubePoint candidate = CubePoint.at(outsideCell, roomLevel);
                        if (isValidEntry(candidate, searchVolume)) {
                            entryCells.add(candidate);
                        }
                    }
                    if (allowVerticalEntries) {
                        CubePoint above = CubePoint.at(roomCell, roomLevel + 1);
                        CubePoint below = CubePoint.at(roomCell, roomLevel - 1);
                        if (isValidEntry(above, searchVolume)) {
                            entryCells.add(above);
                        }
                        if (isValidEntry(below, searchVolume)) {
                            entryCells.add(below);
                        }
                    }
                }
            }
            if (instrumentation != null) {
                instrumentation.recordEntryCellCount(room.roomId(), entryCells.size());
            }
            result.put(room.roomId(), Set.copyOf(entryCells));
        }
        return Map.copyOf(result);
    }

    private static boolean isValidEntry(CubePoint point, SearchVolume searchVolume) {
        return point != null && searchVolume.isPassable(point);
    }

    private static Map<CubePoint, Long> indexRoomIdByEntryCell(Map<Long, Set<CubePoint>> entryCellsByRoomId) {
        Map<CubePoint, Long> result = new LinkedHashMap<>();
        for (Map.Entry<Long, Set<CubePoint>> entry : entryCellsByRoomId.entrySet()) {
            for (CubePoint cell : entry.getValue()) {
                result.put(cell, entry.getKey());
            }
        }
        return Map.copyOf(result);
    }
}
