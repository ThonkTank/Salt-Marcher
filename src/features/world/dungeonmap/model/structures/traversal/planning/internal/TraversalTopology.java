package features.world.dungeonmap.model.structures.traversal.planning.internal;

import features.world.dungeonmap.model.geometry.CubePoint;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

public record TraversalTopology(
        Long corridorId,
        long mapId,
        List<TraversalNode> nodes,
        List<TraversalNodeId> requiredNodeIds,
        Set<CubePoint> obstacles
) {
    public TraversalTopology {
        nodes = normalizeNodes(nodes);
        requiredNodeIds = normalizeRequiredNodeIds(requiredNodeIds, nodes);
        obstacles = normalizeObstacles(obstacles);
    }

    public static TraversalTopology empty() {
        return new TraversalTopology(null, 0L, List.of(), List.of(), Set.of());
    }

    public boolean hasWaypoints() {
        return !requiredWaypointNodes().isEmpty();
    }

    public TraversalNode node(TraversalNodeId nodeId) {
        if (nodeId == null) {
            return null;
        }
        for (TraversalNode node : nodes) {
            if (node != null && nodeId.equals(node.nodeId())) {
                return node;
            }
        }
        return null;
    }

    public List<TraversalNode> roomPortalNodes() {
        return nodesOfKind(TraversalNode.TraversalNodeKind.ROOM_PORTAL);
    }

    public List<TraversalNode> waypointNodes() {
        return nodesOfKind(TraversalNode.TraversalNodeKind.WAYPOINT);
    }

    public List<TraversalNode> requiredNodes() {
        if (requiredNodeIds.isEmpty()) {
            return List.of();
        }
        ArrayList<TraversalNode> result = new ArrayList<>();
        for (TraversalNodeId requiredNodeId : requiredNodeIds) {
            TraversalNode node = node(requiredNodeId);
            if (node != null) {
                result.add(node);
            }
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    public List<TraversalNode> requiredRoomPortalNodes() {
        return requiredNodesOfKind(TraversalNode.TraversalNodeKind.ROOM_PORTAL);
    }

    public List<TraversalNode> requiredWaypointNodes() {
        return requiredNodesOfKind(TraversalNode.TraversalNodeKind.WAYPOINT);
    }

    public List<TraversalNode> backboneNodes() {
        return hasWaypoints() ? requiredWaypointNodes() : requiredRoomPortalNodes();
    }

    public List<TraversalNodeId> attachedPortalNodeIds() {
        if (!hasWaypoints()) {
            return List.of();
        }
        ArrayList<TraversalNodeId> result = new ArrayList<>();
        for (TraversalNode roomPortalNode : requiredRoomPortalNodes()) {
            if (roomPortalNode != null && roomPortalNode.nodeId() != null) {
                result.add(roomPortalNode.nodeId());
            }
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private List<TraversalNode> nodesOfKind(TraversalNode.TraversalNodeKind kind) {
        if (nodes.isEmpty()) {
            return List.of();
        }
        ArrayList<TraversalNode> result = new ArrayList<>();
        for (TraversalNode node : nodes) {
            if (node != null && node.kind() == kind) {
                result.add(node);
            }
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private List<TraversalNode> requiredNodesOfKind(TraversalNode.TraversalNodeKind kind) {
        if (requiredNodeIds.isEmpty()) {
            return List.of();
        }
        ArrayList<TraversalNode> result = new ArrayList<>();
        for (TraversalNodeId requiredNodeId : requiredNodeIds) {
            TraversalNode node = node(requiredNodeId);
            if (node != null && node.kind() == kind) {
                result.add(node);
            }
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private static List<TraversalNode> normalizeNodes(List<TraversalNode> nodes) {
        if (nodes == null || nodes.isEmpty()) {
            return List.of();
        }
        LinkedHashMap<TraversalNodeId, TraversalNode> result = new LinkedHashMap<>();
        for (TraversalNode node : nodes) {
            if (node == null || node.nodeId() == null) {
                continue;
            }
            result.putIfAbsent(node.nodeId(), node);
        }
        return result.isEmpty() ? List.of() : List.copyOf(result.values());
    }

    private static List<TraversalNodeId> normalizeRequiredNodeIds(
            List<TraversalNodeId> requiredNodeIds,
            List<TraversalNode> nodes
    ) {
        if (requiredNodeIds == null || requiredNodeIds.isEmpty()) {
            return List.of();
        }
        Map<TraversalNodeId, TraversalNode> nodesById = new LinkedHashMap<>();
        for (TraversalNode node : nodes == null ? List.<TraversalNode>of() : nodes) {
            if (node != null && node.nodeId() != null) {
                nodesById.putIfAbsent(node.nodeId(), node);
            }
        }
        LinkedHashSet<TraversalNodeId> result = new LinkedHashSet<>();
        for (TraversalNodeId requiredNodeId : requiredNodeIds) {
            if (requiredNodeId != null && nodesById.containsKey(requiredNodeId)) {
                result.add(requiredNodeId);
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
