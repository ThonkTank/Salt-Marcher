package src.data.dungeon.model;

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

    public DungeonCorridorDoorBindingRecord(
            long corridorId,
            long roomId,
            long clusterId,
            int relativeCellX,
            int relativeCellY,
            String edgeDirection
    ) {
        this(corridorId, roomId, clusterId, relativeCellX, relativeCellY, edgeDirection, null);
    }

    public DungeonCorridorDoorBindingRecord {
        edgeDirection = edgeDirection == null || edgeDirection.isBlank() ? "NORTH" : edgeDirection;
        topologyElementId = topologyElementId == null || topologyElementId <= 0L ? null : topologyElementId;
    }
}
