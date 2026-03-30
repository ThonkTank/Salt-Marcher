package features.world.dungeonmap.model.structures.traversal.routing;

import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.model.structures.stair.DungeonStair;
import features.world.dungeonmap.model.structures.traversal.ResolvedTraversalDoorBinding;
import features.world.dungeonmap.model.structures.traversal.Traversal;
import features.world.dungeonmap.model.structures.traversal.TraversalRoute;
import features.world.dungeonmap.model.structures.traversal.TraversalRoutingSnapshot;
import features.world.dungeonmap.model.structures.traversal.routing.internal.TraversalGeometryRealizer;
import features.world.dungeonmap.model.structures.traversal.routing.internal.TraversalStructurePlanner;
import features.world.dungeonmap.model.structures.traversal.routing.internal.TraversalTopology;
import features.world.dungeonmap.model.structures.traversal.routing.internal.TraversalTopologyProjector;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

public final class TraversalRoutingKernel {

    private TraversalRoutingKernel() {
        throw new AssertionError("No instances");
    }

    public static TraversalRoute route(Traversal traversal, TraversalRoutingSnapshot snapshot) {
        if (traversal == null || snapshot == null) {
            return TraversalRoute.empty();
        }
        List<Room> rooms = traversal.resolvedRooms(snapshot);
        List<CubePoint> waypointCells = traversal.resolvedWaypointCells(snapshot);
        Map<Long, ResolvedTraversalDoorBinding> doorBindings = traversal.resolvedDoorBindings(snapshot);
        Set<CubePoint> obstacles = buildObstacles(
                snapshot.roomsById(),
                snapshot.stairs(),
                snapshot.traversalIdByStairId(),
                traversal.traversalId());
        TraversalTopology topology = TraversalTopologyProjector.project(
                traversal.mapId(),
                rooms,
                waypointCells,
                doorBindings,
                obstacles);
        TraversalStructurePlanner.StructurePlan structurePlan = TraversalStructurePlanner.plan(topology);
        return TraversalGeometryRealizer.realize(traversal, structurePlan);
    }

    private static Set<CubePoint> buildObstacles(
            Map<Long, Room> roomsById,
            List<DungeonStair> stairs,
            Map<Long, Long> traversalIdByStairId,
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
            if (stair != null && !java.util.Objects.equals(
                    stair.stairId() == null || traversalIdByStairId == null ? null : traversalIdByStairId.get(stair.stairId()),
                    traversalId)) {
                result.addAll(stair.occupiedPositions());
            }
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }
}
