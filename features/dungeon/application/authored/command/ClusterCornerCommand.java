package features.dungeon.application.authored.command;

import features.dungeon.api.editor.DungeonEditorCommandOutcome;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.structure.DungeonMap;

/** Plans one exact room-cluster corner movement patch. */
public final class ClusterCornerCommand {

    public DungeonCommandResult plan(
            DungeonMap current,
            long clusterId,
            Cell corner,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        if (current == null || clusterId <= 0L || corner == null) {
            return new DungeonCommandResult.Rejected(
                    DungeonEditorCommandOutcome.RejectionReason.INVALID_TARGET);
        }
        return RoomGeometryPatchPlanner.plan(
                current,
                map -> map.moveClusterCorner(clusterId, corner, deltaQ, deltaR, deltaLevel),
                DungeonEditorCommandOutcome.RejectionReason.NO_EFFECT);
    }
}
