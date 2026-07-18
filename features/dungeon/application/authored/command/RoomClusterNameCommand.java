package features.dungeon.application.authored.command;

import features.dungeon.api.editor.DungeonEditorCommandOutcome;
import features.dungeon.domain.core.structure.DungeonMap;
import features.dungeon.domain.core.structure.room.RoomCluster;
import java.util.List;

/** Plans one exact authored room-cluster-name patch. */
public final class RoomClusterNameCommand {

    public DungeonCommandResult plan(DungeonMap current, long clusterId, String name) {
        if (current == null || clusterId <= 0L || name == null || name.isBlank()) {
            return rejected(DungeonEditorCommandOutcome.RejectionReason.INVALID_TARGET);
        }
        RoomCluster before = current.topology().roomCluster(clusterId);
        if (before == null) {
            return rejected(DungeonEditorCommandOutcome.RejectionReason.INVALID_TARGET);
        }
        RoomCluster after = before.withName(name);
        if (after.equals(before)) {
            return rejected(DungeonEditorCommandOutcome.RejectionReason.NO_EFFECT);
        }
        RoomClusterChange change = new RoomClusterChange(
                before,
                after,
                RoomClusterPatchChunks.touchedChunks(current, current, before.clusterId()));
        return DungeonCommandResult.Accepted.from(DungeonPatch.of(
                current.metadata().mapId(),
                current.revision(),
                List.of(change)));
    }

    private static DungeonCommandResult.Rejected rejected(
            DungeonEditorCommandOutcome.RejectionReason reason
    ) {
        return new DungeonCommandResult.Rejected(reason);
    }
}
