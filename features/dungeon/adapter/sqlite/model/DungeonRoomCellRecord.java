package features.dungeon.adapter.sqlite.model;

/** Canonical source-local room-owned floor cell. */
public record DungeonRoomCellRecord(
        long roomId,
        int levelZ,
        int cellX,
        int cellY
) {
}
