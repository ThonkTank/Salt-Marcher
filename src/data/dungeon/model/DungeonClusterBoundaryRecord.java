package src.data.dungeon.model;

import org.jspecify.annotations.Nullable;

public record DungeonClusterBoundaryRecord(
        long clusterId,
        int levelZ,
        int cellX,
        int cellY,
        String edgeDirection,
        String edgeType,
        @Nullable Long topologyElementId
) {

    public DungeonClusterBoundaryRecord {
        edgeDirection = edgeDirection == null || edgeDirection.isBlank() ? "NORTH" : edgeDirection;
        edgeType = edgeType == null || edgeType.isBlank() ? "WALL" : edgeType;
        topologyElementId = DungeonRecordIdNormalizer.positiveLongOrNull(topologyElementId);
    }
}
