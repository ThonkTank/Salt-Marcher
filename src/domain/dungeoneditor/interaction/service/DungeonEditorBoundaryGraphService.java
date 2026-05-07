package src.domain.dungeoneditor.interaction.service;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import src.domain.dungeoneditor.interaction.value.DungeonEditorInteractionValues;
import src.domain.dungeoneditor.interaction.value.DungeonEditorInteractionValues.VertexKey;
import src.domain.dungeoneditor.interaction.value.DungeonEditorInteractionValues.VertexTarget;
import src.domain.dungeoneditor.interaction.value.DungeonEditorMainViewInteractionValues.BoundaryDraft;
import src.domain.dungeoneditor.interaction.value.DungeonEditorMainViewInteractionValues.EdgeKey;
import src.domain.dungeoneditor.interaction.value.DungeonEditorMainViewInteractionValues.PathResult;
import src.domain.dungeoneditor.interaction.value.DungeonEditorMainViewInteractionValues.PointerState;
import src.domain.dungeoneditor.workspace.value.DungeonEditorWorkspaceValues;

public final class DungeonEditorBoundaryGraphService {
    public boolean isEditableVertex(
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            long clusterId,
            VertexTarget vertex,
            boolean deleteMode
    ) {
        DungeonEditorBoundaryEdgeCatalog edgeCatalog = new DungeonEditorBoundaryEdgeCatalog();
        Set<EdgeKey> edges = deleteMode
                ? edgeCatalog.existingInternalBoundaryEdges(
                        snapshot,
                        clusterId,
                        vertex.level(),
                        DungeonEditorWorkspaceValues.BoundaryKind.WALL)
                : edgeCatalog.internalClusterEdges(snapshot, clusterId, vertex.level());
        VertexKey key = DungeonEditorInteractionValues.vertexKey(vertex);
        return edges.stream().anyMatch(edge -> edge.touches(key));
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
        DungeonEditorBoundaryEdgeCatalog edgeCatalog = new DungeonEditorBoundaryEdgeCatalog();
        Set<EdgeKey> traversableEdges = edgeCatalog.internalClusterEdges(snapshot, clusterId, start.level());
        List<EdgeKey> route = DungeonEditorBoundaryGraphPathSupport.shortestPath(start, goal, traversableEdges);
        if (route.isEmpty()) {
            return PathResult.empty();
        }
        Set<EdgeKey> doors = edgeCatalog.existingInternalBoundaryEdges(
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
        DungeonEditorBoundaryEdgeCatalog edgeCatalog = new DungeonEditorBoundaryEdgeCatalog();
        Set<EdgeKey> walls = edgeCatalog.existingInternalBoundaryEdges(
                snapshot,
                clusterId,
                start.level(),
                DungeonEditorWorkspaceValues.BoundaryKind.WALL);
        List<EdgeKey> route = DungeonEditorBoundaryGraphPathSupport.shortestPath(start, goal, walls);
        return route.isEmpty() ? PathResult.empty() : new PathResult(route, new LinkedHashSet<>(route));
    }

    public boolean touchesExistingWall(
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            long clusterId,
            VertexKey vertex
    ) {
        DungeonEditorBoundaryEdgeCatalog edgeCatalog = new DungeonEditorBoundaryEdgeCatalog();
        Set<EdgeKey> edges = new LinkedHashSet<>(edgeCatalog.existingInternalBoundaryEdges(
                snapshot,
                clusterId,
                vertex.level(),
                DungeonEditorWorkspaceValues.BoundaryKind.WALL));
        edges.addAll(edgeCatalog.outerClusterEdges(snapshot, clusterId, vertex.level()));
        return edges.stream().anyMatch(edge -> edge.touches(vertex));
    }
}
