package features.dungeon.adapter.sqlite.model;

import org.jspecify.annotations.Nullable;

public record DungeonCorridorDoorBindingRecord(
        long corridorId,
        long roomId,
        long clusterId,
        int relativeCellX,
        int relativeCellY,
        String edgeDirection,
        @Nullable Long topologyElementId
) {

    public DungeonCorridorDoorBindingRecord {
        edgeDirection = edgeDirection == null || edgeDirection.isBlank() ? "NORTH" : edgeDirection;
        topologyElementId = DungeonRecordIdNormalizer.positiveLongOrNull(topologyElementId);
    }
}
