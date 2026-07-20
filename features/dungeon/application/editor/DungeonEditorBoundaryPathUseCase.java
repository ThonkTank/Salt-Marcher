package features.dungeon.application.editor;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues;
import features.dungeon.application.editor.DungeonEditorInteractionValues.CellKey;
import features.dungeon.application.editor.DungeonEditorInteractionValues.VertexKey;
import features.dungeon.application.editor.DungeonEditorInteractionValues.VertexTarget;
import features.dungeon.application.editor.DungeonEditorMainViewInteractionValues.BoundaryDraft;
import features.dungeon.application.editor.DungeonEditorMainViewInteractionValues.EdgeKey;
import features.dungeon.application.editor.DungeonEditorMainViewInteractionValues.PathResult;
import features.dungeon.application.editor.DungeonEditorMainViewInteractionValues.PointerState;
import features.dungeon.domain.core.component.boundary.BoundaryKind;

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
                BoundaryKind.DOOR);
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
                BoundaryKind.WALL);
        List<EdgeKey> route = pathFinder.shortestPath(start, goal, walls);
        return route.isEmpty() ? PathResult.empty() : new PathResult(route, new LinkedHashSet<>(route));
    }

}
