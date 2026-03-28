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
        List<TraversalNode> roomPortalNodes = projectRoomPortalNodes(request.roomAnchors(), request.doorBindings());
        List<TraversalNode> waypointNodes = projectWaypointNodes(request.waypointCells());
        return new TraversalTopology(
                request.corridorId(),
                request.mapId(),
                mergeNodes(roomPortalNodes, waypointNodes),
                projectBackboneEdges(roomPortalNodes, waypointNodes),
                request.obstacles());
    }

    private static List<TraversalNode> projectRoomPortalNodes(
            List<TraversalRoomAnchor> roomAnchors,
            Map<Long, ResolvedCorridorDoorBinding> doorBindings
    ) {
        if (roomAnchors == null || roomAnchors.isEmpty()) {
            return List.of();
        }
        ArrayList<TraversalNode> result = new ArrayList<>();
        for (TraversalRoomAnchor roomAnchor : roomAnchors) {
            if (roomAnchor == null) {
                continue;
            }
            ResolvedCorridorDoorBinding fixedDoorBinding = roomAnchor.roomId() == null
                    ? null
                    : doorBindings.get(roomAnchor.roomId());
            result.add(TraversalNode.roomPortal(TraversalNodeId.roomPortal(result.size()), roomAnchor, fixedDoorBinding));
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private static List<TraversalNode> projectWaypointNodes(List<CubePoint> waypointCells) {
        if (waypointCells == null || waypointCells.isEmpty()) {
            return List.of();
        }
        ArrayList<TraversalNode> result = new ArrayList<>();
        for (CubePoint waypointCell : waypointCells) {
            if (waypointCell == null) {
                continue;
            }
            result.add(TraversalNode.waypoint(TraversalNodeId.waypoint(result.size()), waypointCell));
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private static List<TraversalNode> mergeNodes(
            List<TraversalNode> roomPortalNodes,
            List<TraversalNode> waypointNodes
    ) {
        ArrayList<TraversalNode> result = new ArrayList<>();
        if (roomPortalNodes != null) {
            result.addAll(roomPortalNodes);
        }
        if (waypointNodes != null) {
            result.addAll(waypointNodes);
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private static List<TraversalEdge> projectBackboneEdges(
            List<TraversalNode> roomPortalNodes,
            List<TraversalNode> waypointNodes
    ) {
        List<TraversalNode> backboneNodes = waypointNodes == null || waypointNodes.isEmpty()
                ? (roomPortalNodes == null ? List.of() : roomPortalNodes)
                : waypointNodes;
        if (backboneNodes.size() < 2) {
            return List.of();
        }
        ArrayList<TraversalEdge> result = new ArrayList<>();
        for (int index = 1; index < backboneNodes.size(); index++) {
            result.add(new TraversalEdge(
                    backboneNodes.get(index - 1).nodeId(),
                    backboneNodes.get(index).nodeId()));
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }
}
