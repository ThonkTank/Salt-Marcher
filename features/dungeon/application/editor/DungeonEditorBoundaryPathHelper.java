package features.dungeon.application.editor;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import features.dungeon.application.editor.DungeonEditorInteractionValues.VertexKey;
import features.dungeon.application.editor.DungeonEditorMainViewInteractionValues.EdgeKey;

final class DungeonEditorBoundaryPathHelper {
    List<EdgeKey> shortestPath(VertexKey start, VertexKey goal, Set<EdgeKey> traversableEdges) {
        if (start == null || goal == null || traversableEdges == null || traversableEdges.isEmpty()) {
            return List.of();
        }
        Map<VertexKey, Set<VertexKey>> adjacency = adjacency(traversableEdges);
        if (!adjacency.containsKey(start) || !adjacency.containsKey(goal)) {
            return List.of();
        }
        Map<VertexKey, VertexKey> previous = visitVertices(start, goal, adjacency);
        return previous.containsKey(goal) ? buildPath(start, goal, previous) : List.of();
    }

    private static Map<VertexKey, Set<VertexKey>> adjacency(Set<EdgeKey> edges) {
        Map<VertexKey, Set<VertexKey>> result = new LinkedHashMap<>();
        for (EdgeKey edge : edges) {
            addAdjacentVertex(result, edge.start(), edge.end());
            addAdjacentVertex(result, edge.end(), edge.start());
        }
        return Map.copyOf(result);
    }

    private static void addAdjacentVertex(
            Map<VertexKey, Set<VertexKey>> result,
            VertexKey vertex,
            VertexKey neighbor
    ) {
        Set<VertexKey> neighbors = result.get(vertex);
        if (neighbors == null) {
            neighbors = new LinkedHashSet<>();
            result.put(vertex, neighbors);
        }
        neighbors.add(neighbor);
    }

    private static Map<VertexKey, VertexKey> visitVertices(
            VertexKey start,
            VertexKey goal,
            Map<VertexKey, Set<VertexKey>> adjacency
    ) {
        List<VertexKey> queue = new ArrayList<>();
        Map<VertexKey, VertexKey> previous = new LinkedHashMap<>();
        queue.add(start);
        previous.put(start, null);
        int nextQueuedIndex = 0;
        while (nextQueuedIndex < queue.size()) {
            VertexKey current = queue.get(nextQueuedIndex);
            nextQueuedIndex++;
            if (current.equals(goal)) {
                return previous;
            }
            visitNeighbors(queue, previous, current, adjacency);
        }
        return previous;
    }

    private static void visitNeighbors(
            List<VertexKey> queue,
            Map<VertexKey, VertexKey> previous,
            VertexKey current,
            Map<VertexKey, Set<VertexKey>> adjacency
    ) {
        List<VertexKey> neighbors = new ArrayList<>(adjacency.getOrDefault(current, Set.of()));
        neighbors.sort(VertexKey.order());
        for (VertexKey neighbor : neighbors) {
            if (!previous.containsKey(neighbor)) {
                previous.put(neighbor, current);
                queue.add(neighbor);
            }
        }
    }

    private static List<EdgeKey> buildPath(
            VertexKey start,
            VertexKey goal,
            Map<VertexKey, VertexKey> previous
    ) {
        List<EdgeKey> path = new ArrayList<>();
        VertexKey current = goal;
        while (!current.equals(start)) {
            VertexKey parent = previous.get(current);
            if (parent == null) {
                return List.of();
            }
            path.add(0, EdgeKey.between(parent, current));
            current = parent;
        }
        return List.copyOf(path);
    }
}
