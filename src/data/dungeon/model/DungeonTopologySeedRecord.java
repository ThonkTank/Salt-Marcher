package src.data.dungeon.model;

/**
 * Source-local spatial seed derived from legacy dungeon tables.
 */
public record DungeonTopologySeedRecord(
        int width,
        int height,
        int roomAnchorQ,
        int roomAnchorR
) {

    public DungeonTopologySeedRecord {
        width = Math.max(6, width);
        height = Math.max(6, height);
        roomAnchorQ = Math.max(1, Math.min(width - 4, roomAnchorQ));
        roomAnchorR = Math.max(1, Math.min(height - 4, roomAnchorR));
    }

    public static DungeonTopologySeedRecord demo() {
        return new DungeonTopologySeedRecord(10, 8, 2, 2);
    }
}
