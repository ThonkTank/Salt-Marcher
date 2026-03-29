package features.world.dungeonmap.model.structures.traversal.planning;

import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.corridor.CorridorPlanningInput;
import features.world.dungeonmap.model.structures.corridor.ResolvedCorridorDoorBinding;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.model.structures.stair.DungeonStair;
import features.world.dungeonmap.model.structures.traversal.TraversalPlan;
import features.world.dungeonmap.model.structures.traversal.planning.internal.TraversalGeometryRealizer;
import features.world.dungeonmap.model.structures.traversal.planning.internal.TraversalStructurePlanner;
import features.world.dungeonmap.model.structures.traversal.planning.internal.TraversalTopology;
import features.world.dungeonmap.model.structures.traversal.planning.internal.TraversalTopologyProjector;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

public final class TraversalPlanningEngine {

    private TraversalPlanningEngine() {
        throw new AssertionError("No instances");
    }

    public static TraversalPlan plan(Corridor corridor, CorridorPlanningInput input) {
        if (corridor == null || input == null) {
            return TraversalPlan.empty();
        }
        List<Room> rooms = corridor.resolvedRooms(input);
        List<CubePoint> waypointCells = corridor.resolvedWaypointCells(input);
        Map<Long, ResolvedCorridorDoorBinding> doorBindings = corridor.resolvedDoorBindings(input);
        Set<CubePoint> obstacles = buildObstacles(input.roomsById(), input.stairs(), corridor.corridorId());
        TraversalTopology topology = TraversalTopologyProjector.project(
                corridor.corridorId(),
                corridor.mapId(),
                rooms,
                waypointCells,
                doorBindings,
                obstacles);
        TraversalStructurePlanner.StructurePlan structurePlan = TraversalStructurePlanner.plan(topology);
        return TraversalGeometryRealizer.realize(structurePlan);
    }

    private static Set<CubePoint> buildObstacles(
            Map<Long, Room> roomsById,
            List<DungeonStair> stairs,
            Long corridorId
    ) {
        LinkedHashSet<CubePoint> result = new LinkedHashSet<>();
        if (roomsById != null && !roomsById.isEmpty()) {
            for (Room room : roomsById.values()) {
                if (room != null && room.roomId() != null) {
                    result.addAll(room.cubePoints());
                }
            }
        }
        for (DungeonStair stair : stairs == null ? List.<DungeonStair>of() : stairs) {
            if (stair != null && !java.util.Objects.equals(stair.corridorId(), corridorId)) {
                result.addAll(stair.occupiedPositions());
            }
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }
}
