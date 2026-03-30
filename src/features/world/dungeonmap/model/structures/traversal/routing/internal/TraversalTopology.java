package features.world.dungeonmap.model.structures.traversal.routing.internal;

import features.world.dungeonmap.model.geometry.CubePoint;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

public record TraversalTopology(
        long mapId,
        List<TraversalNode> nodes,
        List<String> requiredNodeKeys,
        Set<CubePoint> obstacles
) {
    public TraversalTopology {
        nodes = normalizeNodes(nodes);
        requiredNodeKeys = normalizeRequiredNodeKeys(requiredNodeKeys, nodes);
        obstacles = normalizeObstacles(obstacles);
    }

    public static TraversalTopology empty() {
        return new TraversalTopology(0L, List.of(), List.of(), Set.of());
    }

    public boolean hasWaypoints() {
        return !requiredWaypointNodes().isEmpty();
    }

    public TraversalNode node(String nodeKey) {
        if (nodeKey == null || nodeKey.isBlank()) {
            return null;
        }
        for (TraversalNode node : nodes) {
            if (node != null && nodeKey.equals(node.nodeKey())) {
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
        if (requiredNodeKeys.isEmpty()) {
            return List.of();
        }
        ArrayList<TraversalNode> result = new ArrayList<>();
        for (String requiredNodeKey : requiredNodeKeys) {
            TraversalNode node = node(requiredNodeKey);
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
        if (requiredNodeKeys.isEmpty()) {
            return List.of();
        }
        ArrayList<TraversalNode> result = new ArrayList<>();
        for (String requiredNodeKey : requiredNodeKeys) {
            TraversalNode node = node(requiredNodeKey);
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
        LinkedHashMap<String, TraversalNode> result = new LinkedHashMap<>();
        for (TraversalNode node : nodes) {
            if (node == null || node.nodeKey() == null || node.nodeKey().isBlank()) {
                continue;
            }
            result.putIfAbsent(node.nodeKey(), node);
        }
        return result.isEmpty() ? List.of() : List.copyOf(result.values());
    }

    private static List<String> normalizeRequiredNodeKeys(
            List<String> requiredNodeKeys,
            List<TraversalNode> nodes
    ) {
        if (requiredNodeKeys == null || requiredNodeKeys.isEmpty()) {
            return List.of();
        }
        Map<String, TraversalNode> nodesByKey = new LinkedHashMap<>();
        for (TraversalNode node : nodes == null ? List.<TraversalNode>of() : nodes) {
            if (node != null && node.nodeKey() != null && !node.nodeKey().isBlank()) {
                nodesByKey.putIfAbsent(node.nodeKey(), node);
            }
        }
        LinkedHashSet<String> result = new LinkedHashSet<>();
        for (String requiredNodeKey : requiredNodeKeys) {
            if (requiredNodeKey != null && !requiredNodeKey.isBlank() && nodesByKey.containsKey(requiredNodeKey)) {
                result.add(requiredNodeKey);
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
