package src.domain.dungeon.model.worldspace.usecase;

import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import src.domain.dungeon.model.worldspace.helper.DungeonEditorBoundaryClusterCellsHelper;
import src.domain.dungeon.model.worldspace.helper.DungeonEditorBoundaryEdgesHelper;
import src.domain.dungeon.model.worldspace.model.interaction.model.DungeonEditorInteractionValues;
import src.domain.dungeon.model.worldspace.model.interaction.model.DungeonEditorInteractionValues.CellKey;
import src.domain.dungeon.model.worldspace.model.interaction.model.DungeonEditorInteractionValues.VertexKey;
import src.domain.dungeon.model.worldspace.model.interaction.model.DungeonEditorInteractionValues.VertexTarget;
import src.domain.dungeon.model.worldspace.model.interaction.model.DungeonEditorMainViewInteractionValues.EdgeKey;
import src.domain.dungeon.model.worldspace.model.workspace.model.DungeonEditorWorkspaceValues;

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
                ? existingInternalEdges(snapshot, cells, vertex.level(), DungeonEditorWorkspaceValues.BoundaryKind.WALL)
                : boundaryEdges.internal(cells);
        return DungeonEditorBoundaryEdgesHelper.touchesAny(edges, DungeonEditorInteractionValues.vertexKey(vertex));
    }

    boolean touchesExistingWall(
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            long clusterId,
            VertexKey vertex
    ) {
        Set<CellKey> cells = clusterCellsFor(snapshot, clusterId, vertex.level());
        Set<EdgeKey> edges = new LinkedHashSet<>(existingInternalEdges(
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

    private Set<EdgeKey> existingInternalEdges(
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            Set<CellKey> cells,
            int level,
            DungeonEditorWorkspaceValues.BoundaryKind kind
    ) {
        return boundaryEdges.existingInternal(snapshot, boundaryEdges.internal(cells), level, kind);
    }
}
