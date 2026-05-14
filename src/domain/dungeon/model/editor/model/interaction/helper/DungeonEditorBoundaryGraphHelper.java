package src.domain.dungeon.model.editor.model.interaction.helper;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
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
        DungeonEditorBoundaryEdgeCatalogHelper edgeCatalog = new DungeonEditorBoundaryEdgeCatalogHelper();
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
        DungeonEditorBoundaryEdgeCatalogHelper edgeCatalog = new DungeonEditorBoundaryEdgeCatalogHelper();
        Set<EdgeKey> traversableEdges = edgeCatalog.internalClusterEdges(snapshot, clusterId, start.level());
        List<EdgeKey> route = DungeonEditorBoundaryGraphPathHelper.shortestPath(start, goal, traversableEdges);
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
        DungeonEditorBoundaryEdgeCatalogHelper edgeCatalog = new DungeonEditorBoundaryEdgeCatalogHelper();
        Set<EdgeKey> walls = edgeCatalog.existingInternalBoundaryEdges(
                snapshot,
                clusterId,
                start.level(),
                DungeonEditorWorkspaceValues.BoundaryKind.WALL);
        List<EdgeKey> route = DungeonEditorBoundaryGraphPathHelper.shortestPath(start, goal, walls);
        return route.isEmpty() ? PathResult.empty() : new PathResult(route, new LinkedHashSet<>(route));
    }

    public boolean touchesExistingWall(
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            long clusterId,
            VertexKey vertex
    ) {
        DungeonEditorBoundaryEdgeCatalogHelper edgeCatalog = new DungeonEditorBoundaryEdgeCatalogHelper();
        Set<EdgeKey> edges = new LinkedHashSet<>(edgeCatalog.existingInternalBoundaryEdges(
                snapshot,
                clusterId,
                vertex.level(),
                DungeonEditorWorkspaceValues.BoundaryKind.WALL));
        edges.addAll(edgeCatalog.outerClusterEdges(snapshot, clusterId, vertex.level()));
        return edges.stream().anyMatch(edge -> edge.touches(vertex));
    }
}
