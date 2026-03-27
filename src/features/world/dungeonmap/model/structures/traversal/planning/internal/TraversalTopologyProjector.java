package features.world.dungeonmap.model.structures.traversal.planning.internal;

import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.structures.corridor.ResolvedCorridorDoorBinding;
import features.world.dungeonmap.model.structures.traversal.TraversalRoomAnchor;
import features.world.dungeonmap.model.structures.traversal.planning.TraversalPlanRequest;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public final class TraversalTopologyProjector {

    private TraversalTopologyProjector() {
        throw new AssertionError("No instances");
    }

    public static TraversalTopology project(TraversalPlanRequest request) {
        if (request == null) {
            return TraversalTopology.empty();
        }
        return new TraversalTopology(
                request.corridorId(),
                request.mapId(),
                projectRoomPortals(request.roomAnchors(), request.doorBindings()),
                projectWaypointNodes(request.waypointCells()),
                request.obstacles());
    }

    private static List<TraversalTopology.RoomPortal> projectRoomPortals(
            List<TraversalRoomAnchor> roomAnchors,
            Map<Long, ResolvedCorridorDoorBinding> doorBindings
    ) {
        if (roomAnchors == null || roomAnchors.isEmpty()) {
            return List.of();
        }
        ArrayList<TraversalTopology.RoomPortal> result = new ArrayList<>();
        for (TraversalRoomAnchor roomAnchor : roomAnchors) {
            if (roomAnchor == null) {
                continue;
            }
            ResolvedCorridorDoorBinding fixedDoorBinding = roomAnchor.roomId() == null
                    ? null
                    : doorBindings.get(roomAnchor.roomId());
            result.add(new TraversalTopology.RoomPortal(roomAnchor, fixedDoorBinding));
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private static List<TraversalTopology.WaypointNode> projectWaypointNodes(List<CubePoint> waypointCells) {
        if (waypointCells == null || waypointCells.isEmpty()) {
            return List.of();
        }
        ArrayList<TraversalTopology.WaypointNode> result = new ArrayList<>();
        for (CubePoint waypointCell : waypointCells) {
            if (waypointCell == null) {
                continue;
            }
            result.add(new TraversalTopology.WaypointNode(result.size(), waypointCell));
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }
}
