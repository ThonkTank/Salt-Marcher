package features.dungeon.application.editor;

import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues;
import features.dungeon.application.editor.DungeonEditorInteractionValues.CellKey;
import features.dungeon.application.editor.DungeonEditorInteractionValues.VertexKey;
import features.dungeon.application.editor.DungeonEditorInteractionValues.VertexTarget;
import features.dungeon.application.editor.DungeonEditorMainViewInteractionValues.EdgeKey;
import features.dungeon.domain.core.component.boundary.BoundaryKind;

final class DungeonEditorBoundaryVertexUseCase {
    private final DungeonEditorBoundaryClusterCellsHelper clusterCells = new DungeonEditorBoundaryClusterCellsHelper();
    private final DungeonEditorBoundaryEdgesHelper boundaryEdges = new DungeonEditorBoundaryEdgesHelper();

    boolean isEditableVertex(
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            long clusterId,
            VertexTarget vertex,
            boolean deleteMode
    ) {
        Set<CellKey> cells = clusterCellsFor(snapshot, clusterId, vertex.level());
        Set<EdgeKey> edges = deleteMode
                ? boundaryEdges.existingAlongClusterBoundary(
                        snapshot,
                        cells,
                        vertex.level(),
                        BoundaryKind.WALL)
                : boundaryEdges.internal(cells);
        return DungeonEditorBoundaryEdgesHelper.touchesAny(edges, DungeonEditorInteractionValues.vertexKey(vertex));
    }

    boolean touchesExistingWall(
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            long clusterId,
            VertexKey vertex
    ) {
        Set<CellKey> cells = clusterCellsFor(snapshot, clusterId, vertex.level());
        Set<EdgeKey> edges = new LinkedHashSet<>(boundaryEdges.existingWithinCells(
                snapshot,
                cells,
                vertex.level(),
                BoundaryKind.WALL));
        edges.addAll(boundaryEdges.outer(cells));
        return DungeonEditorBoundaryEdgesHelper.touchesAny(edges, vertex);
    }

    Map<Long, Set<CellKey>> clusterCellsByCluster(
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            int level
    ) {
        return clusterCells.collect(snapshot, level);
    }

    Set<CellKey> clusterCellsFor(
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            long clusterId,
            int level
    ) {
        return clusterCellsByCluster(snapshot, level).getOrDefault(clusterId, Set.of());
    }

}
