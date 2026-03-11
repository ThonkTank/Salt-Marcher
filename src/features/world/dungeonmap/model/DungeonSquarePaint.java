package features.world.dungeonmap.model;

public record DungeonSquarePaint(
        int x,
        int y,
        boolean filled,
        Long roomId
) {
}
