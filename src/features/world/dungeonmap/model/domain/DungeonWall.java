package features.world.dungeonmap.model.domain;

public record DungeonWall(
        Long wallId,
        long mapId,
        int x,
        int y,
        PassageDirection direction
) {
    public String edgeKey() {
        return direction.edgeKey(x, y);
    }
}
