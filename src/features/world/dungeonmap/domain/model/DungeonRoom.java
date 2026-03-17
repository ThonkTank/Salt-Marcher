package features.world.dungeonmap.domain.model;

public record DungeonRoom(
        Long roomId,
        long mapId,
        long clusterId,
        String name,
        Point2i componentAnchor
) {
    public DungeonRoom {
        componentAnchor = componentAnchor == null ? new Point2i(0, 0) : componentAnchor;
    }
}
