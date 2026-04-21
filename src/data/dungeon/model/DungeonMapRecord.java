package src.data.dungeon.model;

/**
 * Source-local dungeon map catalog row.
 */
public record DungeonMapRecord(
        long mapId,
        String name,
        long revision,
        DungeonTopologySeedRecord topologySeed
) {

    public DungeonMapRecord {
        name = name == null || name.isBlank() ? "Dungeon " + mapId : name.trim();
        revision = Math.max(1L, revision);
        topologySeed = topologySeed == null ? DungeonTopologySeedRecord.demo() : topologySeed;
    }
}
