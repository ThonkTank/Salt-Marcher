package features.dungeon.application.authored.command;

import features.dungeon.api.editor.DungeonEditorCommandOutcome;
import features.dungeon.domain.core.geometry.Edge;
import features.dungeon.domain.core.structure.DungeonMap;
import java.util.List;

/** Plans one exact room-cluster wall-run stretch patch. */
public final class ClusterBoundaryStretchCommand {

    public DungeonCommandResult plan(
            DungeonMap current,
            long clusterId,
            List<Edge> sourceEdges,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        if (current == null || clusterId <= 0L || sourceEdges == null || sourceEdges.isEmpty()) {
            return new DungeonCommandResult.Rejected(
                    DungeonEditorCommandOutcome.RejectionReason.INVALID_TARGET);
        }
        List<Edge> safeEdges = List.copyOf(sourceEdges);
        return RoomGeometryPatchPlanner.plan(
                current,
                map -> map.moveBoundaryStretch(clusterId, safeEdges, deltaQ, deltaR, deltaLevel),
                DungeonEditorCommandOutcome.RejectionReason.NO_EFFECT);
    }
}
