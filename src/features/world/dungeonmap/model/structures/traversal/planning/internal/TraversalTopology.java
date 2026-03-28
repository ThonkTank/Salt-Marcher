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
        List<TraversalEdge> edges,
        Set<CubePoint> obstacles
) {
    public TraversalTopology {
        nodes = normalizeNodes(nodes);
        edges = normalizeEdges(edges, nodes);
        obstacles = normalizeObstacles(obstacles);
    }

    public static TraversalTopology empty() {
        return new TraversalTopology(null, 0L, List.of(), List.of(), Set.of());
    }

    public boolean hasWaypoints() {
        return !waypointNodes().isEmpty();
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

    public List<TraversalNode> backboneNodes() {
        return hasWaypoints() ? waypointNodes() : roomPortalNodes();
    }

    public List<TraversalNodeId> attachedPortalNodeIds() {
        if (!hasWaypoints()) {
            return List.of();
        }
        ArrayList<TraversalNodeId> result = new ArrayList<>();
        for (TraversalNode roomPortalNode : roomPortalNodes()) {
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

    private static List<TraversalEdge> normalizeEdges(List<TraversalEdge> edges, List<TraversalNode> nodes) {
        if (edges == null || edges.isEmpty()) {
            return List.of();
        }
        Map<TraversalNodeId, TraversalNode> nodesById = new LinkedHashMap<>();
        for (TraversalNode node : nodes == null ? List.<TraversalNode>of() : nodes) {
            if (node != null && node.nodeId() != null) {
                nodesById.putIfAbsent(node.nodeId(), node);
            }
        }
        LinkedHashSet<TraversalEdge> result = new LinkedHashSet<>();
        for (TraversalEdge edge : edges) {
            if (edge == null) {
                continue;
            }
            if (!nodesById.containsKey(edge.startNodeId()) || !nodesById.containsKey(edge.endNodeId())) {
                continue;
            }
            result.add(edge);
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
