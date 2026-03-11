package features.world.dungeonmap.model;

public record DungeonPassage(
        Long passageId,
        long mapId,
        int x,
        int y,
        PassageDirection direction,
        PassageType type,
        String name,
        String notes,
        Long endpointId
) {
    public String edgeKey() {
        return direction.edgeKey(x, y);
    }
}
