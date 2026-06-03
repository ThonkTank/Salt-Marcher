package src.domain.dungeon.model.runtime.usecase;

import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import src.domain.dungeon.model.runtime.helper.DungeonEditorBoundaryClusterCellsHelper;
import src.domain.dungeon.model.runtime.helper.DungeonEditorBoundaryEdgesHelper;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorInteractionValues;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorInteractionValues.CellKey;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorInteractionValues.VertexKey;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorInteractionValues.VertexTarget;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorMainViewInteractionValues.EdgeKey;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues;

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
                        DungeonEditorWorkspaceValues.BoundaryKind.WALL)
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
                DungeonEditorWorkspaceValues.BoundaryKind.WALL));
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
