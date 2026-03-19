package features.world.quarantine.dungeonmap.corridors.model.routing;

import features.world.quarantine.dungeonmap.corridors.model.DungeonCorridor;
import features.world.quarantine.dungeonmap.corridors.model.topology.ResolvedDoorOverride;
import features.world.quarantine.dungeonmap.foundation.geometry.Point2i;
import features.world.quarantine.dungeonmap.layout.model.DungeonLayout;
import features.world.quarantine.dungeonmap.rooms.model.DungeonRoom;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

record CorridorPlanningContext(
        DungeonLayout layout,
        DungeonCorridor corridor,
        List<DungeonRoom> rooms,
        Map<Long, DungeonRoom> roomsById,
        Map<Long, Set<Point2i>> cellsByRoomId,
        Map<Point2i, Long> roomOccupancy,
        List<Point2i> waypointCells
) {

    static CorridorPlanningContext create(
            DungeonLayout layout,
            DungeonCorridor corridor,
            List<DungeonRoom> rooms,
            Map<Long, Set<Point2i>> roomCellsById,
            Map<Point2i, Long> roomOccupancy
    ) {
        Map<Long, DungeonRoom> roomsById = new LinkedHashMap<>();
        Map<Long, Set<Point2i>> cellsByRoomId = new LinkedHashMap<>();
        for (DungeonRoom room : rooms) {
            Long roomId = room.roomId();
            if (roomId == null) {
                continue;
            }
            Set<Point2i> roomCells = roomCellsById.getOrDefault(roomId, Set.of());
            if (roomCells.isEmpty()) {
                throw new IllegalStateException("Raum " + roomId + " hat keine abgeleiteten Zellen fuer Korridor-Geometrie");
            }
            roomsById.put(roomId, room);
            cellsByRoomId.put(roomId, roomCells);
        }
        return new CorridorPlanningContext(
                layout,
                corridor,
                List.copyOf(rooms),
                Map.copyOf(roomsById),
                Map.copyOf(cellsByRoomId),
                Map.copyOf(roomOccupancy),
                CorridorPlanningResolver.resolveWaypointCells(layout, corridor));
    }

    Set<Point2i> roomCells(long roomId) {
        return cellsByRoomId.getOrDefault(roomId, Set.of());
    }

    ResolvedDoorOverride doorOverride(DungeonRoom room) {
        return CorridorPlanningResolver.resolveDoorOverride(layout, corridor, room);
    }

    int totalRoomCount() {
        return rooms.size();
    }
}
