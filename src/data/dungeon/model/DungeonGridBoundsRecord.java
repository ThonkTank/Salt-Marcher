package src.data.dungeon.model;

/**
 * Source-local grid bounds derived from authored dungeon tables.
 */
public record DungeonGridBoundsRecord(
        int width,
        int height,
        int roomAnchorQ,
        int roomAnchorR
) {

    public DungeonGridBoundsRecord {
        width = Math.max(6, width);
        height = Math.max(6, height);
        roomAnchorQ = Math.max(1, Math.min(width - 4, roomAnchorQ));
        roomAnchorR = Math.max(1, Math.min(height - 4, roomAnchorR));
    }

    public static DungeonGridBoundsRecord defaultGrid() {
        return new DungeonGridBoundsRecord(10, 8, 2, 2);
    }
}
