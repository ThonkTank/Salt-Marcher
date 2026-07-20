package features.dungeon.application.authored.command;

import features.dungeon.api.editor.DungeonEditorCommandOutcome;
import features.dungeon.application.authored.port.DungeonIdentityRange;
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
            int deltaLevel,
            DungeonIdentityRange clusterIds,
            DungeonIdentityRange roomIds
    ) {
        if (current == null || clusterId <= 0L || corner == null
                || clusterIds == null || roomIds == null) {
            return new DungeonCommandResult.Rejected(
                    DungeonEditorCommandOutcome.RejectionReason.INVALID_TARGET);
        }
        var ids = RoomGeometryPatchPlanner.reservedIds(clusterIds, roomIds);
        return RoomGeometryPatchPlanner.plan(
                current,
                map -> map.moveClusterCorner(
                        clusterId, corner, deltaQ, deltaR, deltaLevel, ids),
                DungeonEditorCommandOutcome.RejectionReason.NO_EFFECT);
    }
}
