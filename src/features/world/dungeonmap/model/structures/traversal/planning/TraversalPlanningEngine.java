package features.world.dungeonmap.model.structures.traversal.planning;

import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.model.structures.stair.DungeonStair;
import features.world.dungeonmap.model.structures.traversal.ResolvedTraversalDoorBinding;
import features.world.dungeonmap.model.structures.traversal.TraversalPlan;
import features.world.dungeonmap.model.structures.traversal.Traversal;
import features.world.dungeonmap.model.structures.traversal.TraversalPlanningInput;
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

    public static TraversalPlan plan(Traversal traversal, TraversalPlanningInput input) {
        if (traversal == null || input == null) {
            return TraversalPlan.empty();
        }
        List<Room> rooms = traversal.resolvedRooms(input);
        List<CubePoint> waypointCells = traversal.resolvedWaypointCells(input);
        Map<Long, ResolvedTraversalDoorBinding> doorBindings = traversal.resolvedDoorBindings(input);
        Set<CubePoint> obstacles = buildObstacles(input.roomsById(), input.stairs(), traversal.traversalId());
        TraversalTopology topology = TraversalTopologyProjector.project(
                traversal.mapId(),
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
            Long traversalId
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
            if (stair != null && !java.util.Objects.equals(stair.traversalId(), traversalId)) {
                result.addAll(stair.occupiedPositions());
            }
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }
}
