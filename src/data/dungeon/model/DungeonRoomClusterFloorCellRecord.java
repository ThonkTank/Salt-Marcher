package src.data.dungeon.model;

public record DungeonRoomClusterFloorCellRecord(
        long clusterId,
        int levelZ,
        int cellX,
        int cellY
) {
}
