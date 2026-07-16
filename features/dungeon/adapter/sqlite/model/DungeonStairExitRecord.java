package features.dungeon.adapter.sqlite.model;

public record DungeonStairExitRecord(
        long stairId,
        long exitId,
        int cellX,
        int cellY,
        int cellZ,
        String label
) {
}
