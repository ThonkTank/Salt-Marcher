package src.domain.dungeon.model.editor.helper;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Deque;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorInteractionValues.CellKey;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorInteractionValues.TravelHeading;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorInteractionValues;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorInteractionValues.VertexKey;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorInteractionValues.VertexTarget;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorMainViewInteractionValues.BoundaryDraft;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorMainViewInteractionValues.EdgeKey;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorMainViewInteractionValues.PathResult;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorMainViewInteractionValues.PointerState;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues;

public final class DungeonEditorBoundaryGraphHelper {
    public boolean isEditableVertex(
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            long clusterId,
            VertexTarget vertex,
            boolean deleteMode
    ) {
        Set<EdgeKey> edges = deleteMode
                ? existingInternalBoundaryEdges(
                        snapshot,
                        clusterId,
                        vertex.level(),
                        DungeonEditorWorkspaceValues.BoundaryKind.WALL)
                : internalClusterEdges(snapshot, clusterId, vertex.level());
        VertexKey key = DungeonEditorInteractionValues.vertexKey(vertex);
        return touchesAnyEdge(edges, key);
    }

    public PathResult previewCandidate(
            PointerState input,
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
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
        VertexKey nextVertex = DungeonEditorInteractionValues.vertexKey(vertex);
        if (currentDraft.currentVertex().equals(nextVertex)) {
            return PathResult.empty();
        }
        return deleteMode
                ? findDeletePath(snapshot, currentDraft.clusterId(), currentDraft.currentVertex(), nextVertex)
                : findCreatePath(snapshot, currentDraft.clusterId(), currentDraft.currentVertex(), nextVertex);
    }

    public PathResult findCreatePath(
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            long clusterId,
            VertexKey start,
            VertexKey goal
    ) {
        Set<EdgeKey> traversableEdges = internalClusterEdges(snapshot, clusterId, start.level());
        List<EdgeKey> route = shortestPath(start, goal, traversableEdges);
        if (route.isEmpty()) {
            return PathResult.empty();
        }
        Set<EdgeKey> doors = existingInternalBoundaryEdges(
                snapshot,
                clusterId,
                start.level(),
                DungeonEditorWorkspaceValues.BoundaryKind.DOOR);
        Set<EdgeKey> committed = new LinkedHashSet<>(route);
        committed.removeAll(doors);
        return new PathResult(route, committed);
    }

    public PathResult findDeletePath(
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            long clusterId,
            VertexKey start,
            VertexKey goal
    ) {
        Set<EdgeKey> walls = existingInternalBoundaryEdges(
                snapshot,
                clusterId,
                start.level(),
                DungeonEditorWorkspaceValues.BoundaryKind.WALL);
        List<EdgeKey> route = shortestPath(start, goal, walls);
        return route.isEmpty() ? PathResult.empty() : new PathResult(route, new LinkedHashSet<>(route));
    }

    public boolean touchesExistingWall(
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            long clusterId,
            VertexKey vertex
    ) {
        Set<EdgeKey> edges = new LinkedHashSet<>(existingInternalBoundaryEdges(
                snapshot,
                clusterId,
                vertex.level(),
                DungeonEditorWorkspaceValues.BoundaryKind.WALL));
        edges.addAll(outerClusterEdges(snapshot, clusterId, vertex.level()));
        return touchesAnyEdge(edges, vertex);
    }

    private static boolean touchesAnyEdge(Set<EdgeKey> edges, VertexKey vertex) {
        for (EdgeKey edge : edges) {
            if (edge.touches(vertex)) {
                return true;
            }
        }
        return false;
    }

    private Set<EdgeKey> internalClusterEdges(
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            long clusterId,
            int level
    ) {
        Set<CellKey> cells = clusterCells(snapshot, clusterId, level);
        Set<EdgeKey> result = new LinkedHashSet<>();
        for (CellKey cell : cells) {
            for (TravelHeading direction : TravelHeading.values()) {
                CellKey neighbor = cell.neighbor(direction);
                if (cells.contains(neighbor)) {
                    result.add(EdgeKey.sideOf(cell, direction));
                }
            }
        }
        return Set.copyOf(result);
    }

    private Set<EdgeKey> existingInternalBoundaryEdges(
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            long clusterId,
            int level,
            DungeonEditorWorkspaceValues.BoundaryKind kind
    ) {
        Set<EdgeKey> internalEdges = internalClusterEdges(snapshot, clusterId, level);
        Set<EdgeKey> result = new LinkedHashSet<>();
        if (snapshot == null) {
            return Set.of();
        }
        for (DungeonEditorWorkspaceValues.Boundary boundary : snapshot.boundaries()) {
            if (boundary.edge() == null
                    || boundary.edge().from() == null
                    || boundary.edge().to() == null
                    || boundary.edge().from().level() != level
                    || boundary.kind() != kind) {
                continue;
            }
            EdgeKey edge = EdgeKey.from(boundary.edge());
            if (internalEdges.contains(edge)) {
                result.add(edge);
            }
        }
        return Set.copyOf(result);
    }

    private Set<EdgeKey> outerClusterEdges(
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            long clusterId,
            int level
    ) {
        Set<CellKey> cells = clusterCells(snapshot, clusterId, level);
        Set<EdgeKey> result = new LinkedHashSet<>();
        for (CellKey cell : cells) {
            for (TravelHeading direction : TravelHeading.values()) {
                if (!cells.contains(cell.neighbor(direction))) {
                    result.add(EdgeKey.sideOf(cell, direction));
                }
            }
        }
        return Set.copyOf(result);
    }

    private static Set<CellKey> clusterCells(
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            long clusterId,
            int level
    ) {
        if (snapshot == null || !DungeonEditorWorkspaceValues.hasId(clusterId)) {
            return Set.of();
        }
        Set<CellKey> result = new LinkedHashSet<>();
        for (DungeonEditorWorkspaceValues.Area area : snapshot.areas()) {
            if (!area.kind().isRoom() || area.clusterId() != clusterId) {
                continue;
            }
            for (DungeonEditorWorkspaceValues.Cell cell : area.cells()) {
                if (cell.level() == level) {
                    result.add(new CellKey(cell.q(), cell.r(), cell.level()));
                }
            }
        }
        return Set.copyOf(result);
    }

    private static List<EdgeKey> shortestPath(VertexKey start, VertexKey goal, Set<EdgeKey> traversableEdges) {
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
            addNeighbor(result, edge.start(), edge.end());
            addNeighbor(result, edge.end(), edge.start());
        }
        return Map.copyOf(result);
    }

    private static void addNeighbor(Map<VertexKey, Set<VertexKey>> adjacency, VertexKey vertex, VertexKey neighbor) {
        Set<VertexKey> neighbors = adjacency.get(vertex);
        if (neighbors == null) {
            neighbors = new LinkedHashSet<>();
            adjacency.put(vertex, neighbors);
        }
        neighbors.add(neighbor);
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
            for (VertexKey neighbor : orderedNeighbors(adjacency, current)) {
                if (previous.containsKey(neighbor)) {
                    continue;
                }
                previous.put(neighbor, current);
                queue.addLast(neighbor);
            }
        }
        return previous;
    }

    private static List<VertexKey> orderedNeighbors(Map<VertexKey, Set<VertexKey>> adjacency, VertexKey current) {
        List<VertexKey> neighbors = new ArrayList<>(adjacency.getOrDefault(current, Set.of()));
        neighbors.sort(VertexKey.order());
        return List.copyOf(neighbors);
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
