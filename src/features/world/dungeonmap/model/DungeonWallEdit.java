package features.world.dungeonmap.model;

public record DungeonWallEdit(
        int x,
        int y,
        PassageDirection direction,
        boolean wallPresent
) {
    public String edgeKey() {
        return direction.edgeKey(x, y);
    }
}
