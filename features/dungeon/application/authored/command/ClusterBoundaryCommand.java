package features.dungeon.application.authored.command;

import features.dungeon.api.editor.DungeonEditorCommandOutcome;
import features.dungeon.application.authored.port.DungeonIdentityRange;
import features.dungeon.domain.core.geometry.Edge;
import features.dungeon.domain.core.structure.DungeonMap;
import features.dungeon.domain.core.component.boundary.BoundaryKind;
import java.util.List;

/** Plans one exact room-cluster boundary edit patch. */
public final class ClusterBoundaryCommand {

    public DungeonCommandResult plan(
            DungeonMap current,
            long clusterId,
            List<Edge> edges,
            BoundaryKind boundaryKind,
            boolean deleteMode,
            DungeonIdentityRange clusterIds,
            DungeonIdentityRange roomIds
    ) {
        if (current == null || clusterId <= 0L || edges == null || edges.isEmpty()
                || boundaryKind == null || clusterIds == null || roomIds == null) {
            return new DungeonCommandResult.Rejected(
                    DungeonEditorCommandOutcome.RejectionReason.INVALID_TARGET);
        }
        List<Edge> safeEdges = List.copyOf(edges);
        var ids = RoomGeometryPatchPlanner.reservedIds(clusterIds, roomIds);
        return RoomGeometryPatchPlanner.plan(
                current,
                map -> map.editClusterBoundaries(
                        clusterId, safeEdges, boundaryKind, deleteMode, ids),
                rejectionReason(boundaryKind, deleteMode));
    }

    private static DungeonEditorCommandOutcome.RejectionReason rejectionReason(
            BoundaryKind boundaryKind,
            boolean deleteMode
    ) {
        if (!deleteMode) {
            return DungeonEditorCommandOutcome.RejectionReason.NO_EFFECT;
        }
        return boundaryKind == BoundaryKind.WALL
                ? DungeonEditorCommandOutcome.RejectionReason.PROTECTED_EXTERIOR_WALL
                : DungeonEditorCommandOutcome.RejectionReason.REFERENCED_CONNECTION;
    }
}
