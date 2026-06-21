package src.features.dungeon.runtime;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues;
import src.features.dungeon.runtime.DungeonEditorInteractionValues.CellKey;
import src.features.dungeon.runtime.DungeonEditorInteractionValues.VertexKey;
import src.features.dungeon.runtime.DungeonEditorInteractionValues.VertexTarget;
import src.features.dungeon.runtime.DungeonEditorMainViewInteractionValues.BoundaryDraft;
import src.features.dungeon.runtime.DungeonEditorMainViewInteractionValues.EdgeKey;
import src.features.dungeon.runtime.DungeonEditorMainViewInteractionValues.PathResult;
import src.features.dungeon.runtime.DungeonEditorMainViewInteractionValues.PointerState;

final class DungeonEditorBoundaryPathUseCase {
    private final DungeonEditorBoundaryEdgesHelper boundaryEdges = new DungeonEditorBoundaryEdgesHelper();
    private final DungeonEditorBoundaryPathHelper pathFinder = new DungeonEditorBoundaryPathHelper();
    private final DungeonEditorBoundaryVertexUseCase boundaryVertices = new DungeonEditorBoundaryVertexUseCase();

    PathResult previewCandidate(
            PointerState input,
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            BoundaryDraft currentDraft,
            boolean deleteMode
    ) {
        VertexTarget vertex = input == null ? null : input.vertexTarget();
        if (snapshot == null || vertex == null || !vertex.present()) {
            return PathResult.empty();
        }
        if (!boundaryVertices.isEditableVertex(snapshot, currentDraft.clusterId(), vertex, deleteMode)) {
            return PathResult.empty();
        }
        VertexKey nextVertex = new VertexKey(vertex.q(), vertex.r(), vertex.level());
        if (currentDraft.currentVertex().equals(nextVertex)) {
            return PathResult.empty();
        }
        return path(snapshot, currentDraft.clusterId(), currentDraft.currentVertex(), nextVertex, deleteMode);
    }

    PathResult path(
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            long clusterId,
            VertexKey start,
            VertexKey goal,
            boolean deleteMode
    ) {
        Set<CellKey> cells = boundaryVertices.clusterCellsFor(snapshot, clusterId, start.level());
        return deleteMode
                ? findDeletePath(snapshot, cells, start, goal)
                : findCreatePath(snapshot, cells, start, goal);
    }

    private PathResult findCreatePath(
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            Set<CellKey> cells,
            VertexKey start,
            VertexKey goal
    ) {
        Set<EdgeKey> traversableEdges = boundaryEdges.internal(cells);
        List<EdgeKey> route = pathFinder.shortestPath(start, goal, traversableEdges);
        if (route.isEmpty()) {
            return PathResult.empty();
        }
        Set<EdgeKey> doors = boundaryEdges.existingWithinCells(
                snapshot,
                cells,
                start.level(),
                DungeonEditorWorkspaceValues.BoundaryKind.DOOR);
        Set<EdgeKey> committed = new LinkedHashSet<>(route);
        committed.removeAll(doors);
        return new PathResult(route, committed);
    }

    private PathResult findDeletePath(
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            Set<CellKey> cells,
            VertexKey start,
            VertexKey goal
    ) {
        Set<EdgeKey> walls = boundaryEdges.existingAlongClusterBoundary(
                snapshot,
                cells,
                start.level(),
                DungeonEditorWorkspaceValues.BoundaryKind.WALL);
        List<EdgeKey> route = pathFinder.shortestPath(start, goal, walls);
        return route.isEmpty() ? PathResult.empty() : new PathResult(route, new LinkedHashSet<>(route));
    }

}
