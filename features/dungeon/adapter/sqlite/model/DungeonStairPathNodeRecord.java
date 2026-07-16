package features.dungeon.adapter.sqlite.model;

public record DungeonStairPathNodeRecord(
        long stairId,
        int cellX,
        int cellY,
        int cellZ
) {
}
