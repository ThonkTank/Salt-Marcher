package features.dungeon.adapter.sqlite.model;

public record DungeonRoomClusterFloorCellRecord(
        long clusterId,
        int levelZ,
        int cellX,
        int cellY
) {
}
