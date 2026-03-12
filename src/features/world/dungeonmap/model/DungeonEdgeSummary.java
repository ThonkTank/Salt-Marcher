package features.world.dungeonmap.model;

public record DungeonEdgeSummary(
        int x,
        int y,
        PassageDirection direction,
        DungeonWall wall,
        DungeonPassage passage
) {
    public String edgeKey() {
        return direction.edgeKey(x, y);
    }
}
