package src.data.dungeon.model;

public record DungeonClusterBoundaryRecord(
        long clusterId,
        int levelZ,
        int cellX,
        int cellY,
        String edgeDirection,
        String edgeType
) {

    public DungeonClusterBoundaryRecord {
        edgeDirection = edgeDirection == null || edgeDirection.isBlank() ? "NORTH" : edgeDirection;
        edgeType = edgeType == null || edgeType.isBlank() ? "WALL" : edgeType;
    }
}
