package src.domain.dungeon.model.worldspace.usecase;

import java.util.Set;
import src.domain.dungeon.model.worldspace.helper.DungeonEditorBoundaryClusterResolutionHelper;
import src.domain.dungeon.model.worldspace.interaction.model.DungeonEditorInteractionValues.CellKey;
import src.domain.dungeon.model.worldspace.interaction.model.DungeonEditorInteractionValues.VertexTarget;
import src.domain.dungeon.model.worldspace.interaction.model.DungeonEditorMainViewInteractionValues.PointerState;
import src.domain.dungeon.model.worldspace.session.model.DungeonEditorSessionValues;
import src.domain.dungeon.model.worldspace.workspace.model.DungeonEditorWorkspaceValues;

final class DungeonEditorBoundaryClusterUseCase {
    private final DungeonEditorBoundaryClusterResolutionHelper clusterResolver = new DungeonEditorBoundaryClusterResolutionHelper();
    private final DungeonEditorBoundaryVertexUseCase boundaryVertices = new DungeonEditorBoundaryVertexUseCase();

    long resolveClusterId(
            PointerState input,
            VertexTarget vertex,
            boolean deleteMode,
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            DungeonEditorSessionValues.Selection selection
    ) {
        if (selection != null
                && DungeonEditorWorkspaceValues.hasId(selection.clusterId())
                && boundaryVertices.isEditableVertex(snapshot, selection.clusterId(), vertex, deleteMode)) {
            return selection.clusterId();
        }
        long boundaryClusterId = clusterResolver.resolveBoundaryClusterId(snapshot, input.boundaryTarget());
        if (DungeonEditorWorkspaceValues.hasId(boundaryClusterId)
                && boundaryVertices.isEditableVertex(snapshot, boundaryClusterId, vertex, deleteMode)) {
            return boundaryClusterId;
        }
        return nearestEditableCluster(snapshot, vertex, deleteMode);
    }

    private long nearestEditableCluster(
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            VertexTarget vertex,
            boolean deleteMode
    ) {
        long bestClusterId = 0L;
        double bestDistance = Double.MAX_VALUE;
        for (var entry : boundaryVertices.clusterCellsByCluster(snapshot, vertex.level()).entrySet()) {
            if (!boundaryVertices.isEditableVertex(snapshot, entry.getKey(), vertex, deleteMode)) {
                continue;
            }
            double distance = distanceToClusterCenter(vertex, entry.getValue());
            if (bestClusterId == 0L || distance < bestDistance
                    || distance == bestDistance && entry.getKey() < bestClusterId) {
                bestClusterId = entry.getKey();
                bestDistance = distance;
            }
        }
        return bestClusterId;
    }

    private static double distanceToClusterCenter(VertexTarget vertex, Set<CellKey> cells) {
        double q = 0.0;
        double r = 0.0;
        for (CellKey cell : cells) {
            q += cell.q() + 0.5;
            r += cell.r() + 0.5;
        }
        int count = Math.max(1, cells.size());
        return Math.hypot(q / count - vertex.q(), r / count - vertex.r());
    }
}
