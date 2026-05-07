package src.domain.dungeoneditor.interaction.service;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Deque;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import src.domain.dungeoneditor.interaction.value.DungeonEditorInteractionValues.VertexKey;
import src.domain.dungeoneditor.interaction.value.DungeonEditorMainViewInteractionValues.EdgeKey;

final class DungeonEditorBoundaryGraphPathSupport {

    private DungeonEditorBoundaryGraphPathSupport() {
    }

    static List<EdgeKey> shortestPath(VertexKey start, VertexKey goal, Set<EdgeKey> traversableEdges) {
        if (!hasPathInputs(start, goal, traversableEdges)) {
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
        for (EdgeKey edge : edges == null ? Set.<EdgeKey>of() : edges) {
            result.computeIfAbsent(edge.start(), ignored -> new LinkedHashSet<>()).add(edge.end());
            result.computeIfAbsent(edge.end(), ignored -> new LinkedHashSet<>()).add(edge.start());
        }
        return Map.copyOf(result);
    }

    private static boolean hasPathInputs(VertexKey start, VertexKey goal, Set<EdgeKey> traversableEdges) {
        return start != null && goal != null && traversableEdges != null && !traversableEdges.isEmpty();
    }

    private static Map<VertexKey, VertexKey> visitVertices(
            VertexKey start,
            VertexKey goal,
            Map<VertexKey, Set<VertexKey>> adjacency
    ) {
        Deque<VertexKey> queue = new ArrayDeque<>();
        Map<VertexKey, VertexKey> previous = new LinkedHashMap<>();
        queue.add(start);
        previous.put(start, null);
        while (!queue.isEmpty()) {
            VertexKey current = queue.removeFirst();
            if (current.equals(goal)) {
                return previous;
            }
            visitNeighbors(current, adjacency, previous, queue);
        }
        return previous;
    }

    private static void visitNeighbors(
            VertexKey current,
            Map<VertexKey, Set<VertexKey>> adjacency,
            Map<VertexKey, VertexKey> previous,
            Deque<VertexKey> queue
    ) {
        for (VertexKey neighbor : orderedNeighbors(adjacency, current)) {
            if (previous.containsKey(neighbor)) {
                continue;
            }
            previous.put(neighbor, current);
            queue.addLast(neighbor);
        }
    }

    private static List<VertexKey> orderedNeighbors(Map<VertexKey, Set<VertexKey>> adjacency, VertexKey current) {
        return adjacency.getOrDefault(current, Set.of()).stream().sorted(VertexKey.order()).toList();
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
            path.add(EdgeKey.between(parent, current));
            current = parent;
        }
        Collections.reverse(path);
        return List.copyOf(path);
    }
}
