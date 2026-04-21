package src.data.dungeon.model;

public record DungeonStairExitRecord(
        long stairId,
        long exitId,
        int cellX,
        int cellY,
        int cellZ,
        String label
) {
}
