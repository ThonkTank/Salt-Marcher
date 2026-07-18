package features.dungeon.application.authored.command;

import features.dungeon.api.DungeonChunkKey;
import features.dungeon.api.editor.DungeonEditorCommandOutcome;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.structure.DungeonMap;
import features.dungeon.domain.core.structure.room.DungeonClusterBoundary;
import features.dungeon.domain.core.structure.room.RoomCluster;
import features.dungeon.domain.core.structure.room.RoomRegion;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

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
        return DungeonCommandResult.Accepted.from(DungeonPatch.of(
                current.metadata().mapId(),
                current.revision(),
                List.of(new RoomClusterChange(before, after, touchedChunks(current, before)))));
    }

    private static Set<DungeonChunkKey> touchedChunks(DungeonMap current, RoomCluster cluster) {
        Set<DungeonChunkKey> result = new LinkedHashSet<>();
        for (RoomRegion room : current.rooms().roomsInCluster(cluster.clusterId())) {
            for (Cell cell : room.floorCells()) {
                addChunk(result, current, cell);
            }
        }
        for (DungeonClusterBoundary boundary : cluster.orderedAuthoredBoundaries()) {
            addChunk(result, current, boundary.absoluteCell(cluster.center()));
        }
        if (result.isEmpty()) {
            addChunk(result, current, cluster.center());
        }
        return Set.copyOf(result);
    }

    private static void addChunk(Set<DungeonChunkKey> result, DungeonMap current, Cell cell) {
        result.add(new DungeonChunkKey(
                current.metadata().mapId().value(),
                cell.level(),
                Math.floorDiv(cell.q(), DungeonChunkKey.CHUNK_SIZE),
                Math.floorDiv(cell.r(), DungeonChunkKey.CHUNK_SIZE)));
    }

    private static DungeonCommandResult.Rejected rejected(
            DungeonEditorCommandOutcome.RejectionReason reason
    ) {
        return new DungeonCommandResult.Rejected(reason);
    }
}
