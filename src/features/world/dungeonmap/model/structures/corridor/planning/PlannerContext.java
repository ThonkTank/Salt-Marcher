package features.world.dungeonmap.model.structures.corridor.planning;

import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.structures.corridor.ResolvedCorridorDoorBinding;
import features.world.dungeonmap.model.structures.room.Room;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

final class PlannerContext {

    private final List<Room> rooms;
    private final List<Point2i> waypointCells;
    private final Map<Long, ResolvedCorridorDoorBinding> doorBindings;
    private final Map<Point2i, Long> occupancy;
    private final PathfindingSpace pathfindingSpace;
    private final PlannerInstrumentation instrumentation;
    private final Map<Long, List<ExitCandidate>> allExitCandidatesByRoomId = new HashMap<>();

    PlannerContext(
            List<Room> rooms,
            List<Point2i> waypointCells,
            Map<Long, ResolvedCorridorDoorBinding> doorBindings,
            PlannerInstrumentation instrumentation
    ) {
        this.rooms = rooms == null ? List.of() : List.copyOf(rooms);
        this.waypointCells = waypointCells == null ? List.of() : List.copyOf(waypointCells);
        this.doorBindings = doorBindings == null ? Map.of() : Map.copyOf(doorBindings);
        this.occupancy = roomOccupancy(this.rooms);
        // Future performance track only: if drag-preview profiling shows long-corridor pressure,
        // this occupancy/grid setup is the first candidate for per-drag-session reuse.
        this.pathfindingSpace = RouteSearch.buildPathfindingSpace(this.occupancy.keySet());
        this.instrumentation = instrumentation;
    }

    List<Room> rooms() {
        return rooms;
    }

    List<Point2i> waypointCells() {
        return waypointCells;
    }

    Map<Long, ResolvedCorridorDoorBinding> doorBindings() {
        return doorBindings;
    }

    Map<Point2i, Long> occupancy() {
        return occupancy;
    }

    PathfindingSpace pathfindingSpace() {
        return pathfindingSpace;
    }

    PlannerInstrumentation instrumentation() {
        return instrumentation;
    }

    List<ExitCandidate> allExitCandidates(Room room) {
        if (room == null || room.roomId() == null) {
            return List.of();
        }
        return allExitCandidatesByRoomId.computeIfAbsent(
                room.roomId(),
                ignored -> {
                    List<ExitCandidate> candidates = ExitCandidateSelector.collectExitCandidates(room, occupancy, doorBindings);
                    if (instrumentation != null) {
                        instrumentation.recordExitCandidateCount(room.roomId(), candidates.size());
                    }
                    return candidates;
                });
    }

    private static Map<Point2i, Long> roomOccupancy(List<Room> rooms) {
        Map<Point2i, Long> result = new LinkedHashMap<>();
        for (Room room : rooms == null ? List.<Room>of() : rooms) {
            if (room == null || room.roomId() == null) {
                continue;
            }
            for (Point2i cell : room.cells()) {
                result.put(cell, room.roomId());
            }
        }
        return Map.copyOf(result);
    }
}
