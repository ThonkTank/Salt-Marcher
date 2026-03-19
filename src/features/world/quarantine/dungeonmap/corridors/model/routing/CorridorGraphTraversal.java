package features.world.quarantine.dungeonmap.corridors.model.routing;

import java.util.ArrayDeque;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;

final class CorridorGraphTraversal {

    private CorridorGraphTraversal() {
        throw new AssertionError("No instances");
    }

    @SafeVarargs
    static Map<CorridorNetworkGraph.NetworkNode, Integer> bfsDistances(
            CorridorNetworkGraph.NetworkNode start,
            Map<CorridorNetworkGraph.NetworkNode, Set<CorridorNetworkGraph.NetworkNode>>... graphs
    ) {
        ArrayDeque<CorridorNetworkGraph.NetworkNode> queue = new ArrayDeque<>();
        Map<CorridorNetworkGraph.NetworkNode, Integer> distances = new HashMap<>();
        queue.add(start);
        distances.put(start, 0);
        while (!queue.isEmpty()) {
            CorridorNetworkGraph.NetworkNode current = queue.removeFirst();
            int currentDistance = distances.get(current);
            for (Map<CorridorNetworkGraph.NetworkNode, Set<CorridorNetworkGraph.NetworkNode>> graph : graphs) {
                for (CorridorNetworkGraph.NetworkNode next : graph.getOrDefault(current, Set.of())) {
                    if (!distances.containsKey(next)) {
                        distances.put(next, currentDistance + 1);
                        queue.addLast(next);
                    }
                }
            }
        }
        return distances;
    }

    @SafeVarargs
    static int componentCount(
            Map<CorridorNetworkGraph.CorridorNode, Set<CorridorNetworkGraph.CorridorNode>>... graphs
    ) {
        boolean allEmpty = true;
        for (Map<CorridorNetworkGraph.CorridorNode, Set<CorridorNetworkGraph.CorridorNode>> graph : graphs) {
            if (!graph.isEmpty()) {
                allEmpty = false;
                break;
            }
        }
        if (allEmpty) {
            return 0;
        }
        Set<CorridorNetworkGraph.CorridorNode> visited = new LinkedHashSet<>();
        LinkedHashSet<CorridorNetworkGraph.CorridorNode> allNodes = new LinkedHashSet<>();
        for (Map<CorridorNetworkGraph.CorridorNode, Set<CorridorNetworkGraph.CorridorNode>> graph : graphs) {
            allNodes.addAll(graph.keySet());
        }
        int components = 0;
        for (CorridorNetworkGraph.CorridorNode node : allNodes) {
            if (!visited.add(node)) {
                continue;
            }
            components++;
            ArrayDeque<CorridorNetworkGraph.CorridorNode> queue = new ArrayDeque<>();
            queue.add(node);
            while (!queue.isEmpty()) {
                CorridorNetworkGraph.CorridorNode current = queue.removeFirst();
                for (Map<CorridorNetworkGraph.CorridorNode, Set<CorridorNetworkGraph.CorridorNode>> graph : graphs) {
                    for (CorridorNetworkGraph.CorridorNode next : graph.getOrDefault(current, Set.of())) {
                        if (visited.add(next)) {
                            queue.addLast(next);
                        }
                    }
                }
            }
        }
        return components;
    }
}
