package features.world.dungeonmap.model.structures.traversal.routing;

import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.model.structures.stair.DungeonStair;
import features.world.dungeonmap.model.structures.traversal.Traversal;
import features.world.dungeonmap.model.structures.traversal.TraversalDoorBinding;
import features.world.dungeonmap.model.structures.traversal.TraversalRoute;
import features.world.dungeonmap.model.structures.traversal.TraversalRoutingSnapshot;
import features.world.dungeonmap.model.structures.traversal.TraversalWaypointBinding;
import features.world.dungeonmap.model.structures.traversal.routing.internal.TraversalGeometryRealizer;
import features.world.dungeonmap.model.structures.traversal.routing.internal.TraversalNode;
import features.world.dungeonmap.model.structures.traversal.routing.internal.TraversalStructurePlanner;
import features.world.dungeonmap.model.structures.traversal.routing.internal.TraversalTopology;
import features.world.dungeonmap.model.structures.traversal.routing.internal.TraversalTopologyProjector;

import java.util.ArrayList;
import java.util.LinkedHashMap;
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
        List<Room> rooms = resolvedRooms(traversal, snapshot);
        List<CubePoint> waypointCells = resolvedWaypointCells(traversal, snapshot);
        Map<Long, TraversalNode.FixedDoorBinding> doorBindings = resolvedDoorBindings(traversal, snapshot);
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

    private static List<Room> resolvedRooms(Traversal traversal, TraversalRoutingSnapshot snapshot) {
        List<Room> result = new ArrayList<>();
        LinkedHashSet<Long> seen = new LinkedHashSet<>();
        for (Long roomId : traversal.roomIds()) {
            if (roomId == null || !seen.add(roomId)) {
                continue;
            }
            Room room = snapshot.room(roomId);
            if (room != null) {
                result.add(room);
            }
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private static List<CubePoint> resolvedWaypointCells(Traversal traversal, TraversalRoutingSnapshot snapshot) {
        if (traversal.bindings().waypoints().isEmpty()) {
            return List.of();
        }
        List<CubePoint> result = new ArrayList<>();
        for (TraversalWaypointBinding waypoint : traversal.bindings().waypoints()) {
            Point2i clusterCenter = snapshot.clusterCenter(waypoint.clusterId());
            if (clusterCenter != null) {
                result.add(CubePoint.at(waypoint.absoluteCell(clusterCenter), waypoint.levelZ()));
            }
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private static Map<Long, TraversalNode.FixedDoorBinding> resolvedDoorBindings(
            Traversal traversal,
            TraversalRoutingSnapshot snapshot
    ) {
        if (traversal.bindings().doorBindings().isEmpty()) {
            return Map.of();
        }
        Map<Long, TraversalNode.FixedDoorBinding> result = new LinkedHashMap<>();
        for (TraversalDoorBinding binding : traversal.bindings().doorBindings()) {
            Point2i clusterCenter = snapshot.clusterCenter(binding.clusterId());
            if (clusterCenter != null) {
                result.put(binding.roomId(), new TraversalNode.FixedDoorBinding(
                        binding.absoluteCell(clusterCenter),
                        binding.direction()));
            }
        }
        return result.isEmpty() ? Map.of() : Map.copyOf(result);
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
