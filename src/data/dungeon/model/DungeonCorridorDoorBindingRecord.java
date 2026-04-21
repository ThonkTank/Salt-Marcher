package src.data.dungeon.model;

public record DungeonCorridorDoorBindingRecord(
        long corridorId,
        long roomId,
        long clusterId,
        int relativeCellX,
        int relativeCellY,
        String edgeDirection
) {

    public DungeonCorridorDoorBindingRecord {
        edgeDirection = edgeDirection == null || edgeDirection.isBlank() ? "NORTH" : edgeDirection;
    }
}
