package src.domain.dungeoneditor.interaction.service;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import src.domain.dungeon.published.DungeonBoundaryKind;
import src.domain.dungeon.published.DungeonSnapshot;
import src.domain.dungeoneditor.interaction.value.DungeonEditorInteractionValues.VertexKey;
import src.domain.dungeoneditor.interaction.value.DungeonEditorInteractionValues.VertexTarget;
import src.domain.dungeoneditor.interaction.value.DungeonEditorMainViewInteractionValues.BoundaryDraft;
import src.domain.dungeoneditor.interaction.value.DungeonEditorMainViewInteractionValues.EdgeKey;
import src.domain.dungeoneditor.interaction.value.DungeonEditorMainViewInteractionValues.PathResult;
import src.domain.dungeoneditor.interaction.value.DungeonEditorMainViewInteractionValues.PointerState;

public final class DungeonEditorBoundaryGraphService {
    private final DungeonEditorBoundaryEdgeCatalog edgeCatalog = new DungeonEditorBoundaryEdgeCatalog();

    public boolean isEditableVertex(DungeonSnapshot snapshot, long clusterId, VertexTarget vertex, boolean deleteMode) {
        Set<EdgeKey> edges = deleteMode
                ? edgeCatalog.existingInternalBoundaryEdges(snapshot, clusterId, vertex.level(), DungeonBoundaryKind.WALL)
                : edgeCatalog.internalClusterEdges(snapshot, clusterId, vertex.level());
        VertexKey key = new VertexKey(vertex.q(), vertex.r(), vertex.level());
        return edges.stream().anyMatch(edge -> edge.touches(key));
    }

    public PathResult previewCandidate(
            PointerState input,
            DungeonSnapshot snapshot,
            BoundaryDraft currentDraft,
            boolean deleteMode
    ) {
        var vertex = input == null ? null : input.vertexTarget();
        if (snapshot == null || vertex == null || !vertex.present()) {
            return PathResult.empty();
        }
        if (!isEditableVertex(snapshot, currentDraft.clusterId(), vertex, deleteMode)) {
            return PathResult.empty();
        }
        VertexKey nextVertex = new VertexKey(vertex.q(), vertex.r(), vertex.level());
        if (currentDraft.currentVertex().equals(nextVertex)) {
            return PathResult.empty();
        }
        return deleteMode
                ? findDeletePath(snapshot, currentDraft.clusterId(), currentDraft.currentVertex(), nextVertex)
                : findCreatePath(snapshot, currentDraft.clusterId(), currentDraft.currentVertex(), nextVertex);
    }

    public PathResult findCreatePath(DungeonSnapshot snapshot, long clusterId, VertexKey start, VertexKey goal) {
        Set<EdgeKey> traversableEdges = edgeCatalog.internalClusterEdges(snapshot, clusterId, start.level());
        List<EdgeKey> route = shortestPath(start, goal, traversableEdges);
        if (route.isEmpty()) {
            return PathResult.empty();
        }
        Set<EdgeKey> doors = edgeCatalog.existingInternalBoundaryEdges(snapshot, clusterId, start.level(), DungeonBoundaryKind.DOOR);
        Set<EdgeKey> committed = new LinkedHashSet<>(route);
        committed.removeAll(doors);
        return new PathResult(route, committed);
    }

    public PathResult findDeletePath(DungeonSnapshot snapshot, long clusterId, VertexKey start, VertexKey goal) {
        Set<EdgeKey> walls = edgeCatalog.existingInternalBoundaryEdges(snapshot, clusterId, start.level(), DungeonBoundaryKind.WALL);
        List<EdgeKey> route = shortestPath(start, goal, walls);
        return route.isEmpty() ? PathResult.empty() : new PathResult(route, new LinkedHashSet<>(route));
    }

    public boolean touchesExistingWall(DungeonSnapshot snapshot, long clusterId, VertexKey vertex) {
        Set<EdgeKey> edges = new LinkedHashSet<>(edgeCatalog.existingInternalBoundaryEdges(
                snapshot,
                clusterId,
                vertex.level(),
                DungeonBoundaryKind.WALL));
        edges.addAll(edgeCatalog.outerClusterEdges(snapshot, clusterId, vertex.level()));
        return edges.stream().anyMatch(edge -> edge.touches(vertex));
    }

    private static List<EdgeKey> shortestPath(VertexKey start, VertexKey goal, Set<EdgeKey> traversableEdges) {
        if (start == null || goal == null || traversableEdges == null || traversableEdges.isEmpty()) {
            return List.of();
        }
        Map<VertexKey, Set<VertexKey>> adjacency = adjacency(traversableEdges);
        if (!adjacency.containsKey(start) || !adjacency.containsKey(goal)) {
            return List.of();
        }
        ArrayDeque<VertexKey> queue = new ArrayDeque<>();
        Map<VertexKey, VertexKey> previous = new LinkedHashMap<>();
        queue.add(start);
        previous.put(start, null);
        while (!queue.isEmpty()) {
            VertexKey current = queue.removeFirst();
            if (current.equals(goal)) {
                break;
            }
            for (VertexKey neighbor : adjacency.getOrDefault(current, Set.of()).stream().sorted(VertexKey.order()).toList()) {
                if (previous.containsKey(neighbor)) {
                    continue;
                }
                previous.put(neighbor, current);
                queue.addLast(neighbor);
            }
        }
        if (!previous.containsKey(goal)) {
            return List.of();
        }
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

    private static Map<VertexKey, Set<VertexKey>> adjacency(Set<EdgeKey> edges) {
        Map<VertexKey, Set<VertexKey>> result = new LinkedHashMap<>();
        for (EdgeKey edge : edges == null ? Set.<EdgeKey>of() : edges) {
            result.computeIfAbsent(edge.start(), ignored -> new LinkedHashSet<>()).add(edge.end());
            result.computeIfAbsent(edge.end(), ignored -> new LinkedHashSet<>()).add(edge.start());
        }
        return Map.copyOf(result);
    }
}
