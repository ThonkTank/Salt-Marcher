package features.world.quarantine.dungeonmap.rooms.model;
import features.world.quarantine.dungeonmap.foundation.geometry.Point2i;


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

    public int distanceTo(DungeonRoom other) {
        return DungeonRoomGeometry.componentDistance(this, other);
    }
}
