package features.world.dungeonmap.model.structures.traversal.planning;

import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.structures.corridor.ResolvedCorridorDoorBinding;
import features.world.dungeonmap.model.structures.traversal.TraversalRoomAnchor;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

public record TraversalPlanRequest(
        Long corridorId,
        long mapId,
        List<TraversalRoomAnchor> roomAnchors,
        List<CubePoint> waypointCells,
        Map<Long, ResolvedCorridorDoorBinding> doorBindings,
        Set<CubePoint> obstacles
) {
    public TraversalPlanRequest {
        roomAnchors = normalizeRoomAnchors(roomAnchors);
        waypointCells = normalizeWaypointCells(waypointCells);
        doorBindings = doorBindings == null ? Map.of() : Map.copyOf(doorBindings);
        obstacles = normalizeObstacles(obstacles);
    }

    public static TraversalPlanRequest empty() {
        return new TraversalPlanRequest(null, 0L, List.of(), List.of(), Map.of(), Set.of());
    }

    private static List<TraversalRoomAnchor> normalizeRoomAnchors(List<TraversalRoomAnchor> roomAnchors) {
        if (roomAnchors == null || roomAnchors.isEmpty()) {
            return List.of();
        }
        ArrayList<TraversalRoomAnchor> result = new ArrayList<>();
        for (TraversalRoomAnchor roomAnchor : roomAnchors) {
            if (roomAnchor != null) {
                result.add(roomAnchor);
            }
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private static List<CubePoint> normalizeWaypointCells(List<CubePoint> waypointCells) {
        if (waypointCells == null || waypointCells.isEmpty()) {
            return List.of();
        }
        ArrayList<CubePoint> result = new ArrayList<>();
        for (CubePoint waypointCell : waypointCells) {
            if (waypointCell != null) {
                result.add(waypointCell);
            }
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private static Set<CubePoint> normalizeObstacles(Set<CubePoint> obstacles) {
        if (obstacles == null || obstacles.isEmpty()) {
            return Set.of();
        }
        LinkedHashSet<CubePoint> result = new LinkedHashSet<>();
        for (CubePoint obstacle : obstacles) {
            if (obstacle != null) {
                result.add(obstacle);
            }
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }
}
