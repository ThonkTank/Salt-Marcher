package features.world.quarantine.dungeonmap.rooms.model;
import features.world.quarantine.dungeonmap.foundation.geometry.Point2i;

import features.world.quarantine.dungeonmap.layout.model.DungeonLayout;

import java.util.Objects;

public final class DungeonGeometry {

    private DungeonGeometry() {
        throw new AssertionError("No instances");
    }

    public record EdgeVertices(Point2i start, Point2i end) {}

    public static EdgeVertices edgeVertices(Point2i cell, DungeonRoomCluster.EdgeDirection direction) {
        return switch (direction) {
            case NORTH -> new EdgeVertices(new Point2i(cell.x(), cell.y()), new Point2i(cell.x() + 1, cell.y()));
            case EAST  -> new EdgeVertices(new Point2i(cell.x() + 1, cell.y()), new Point2i(cell.x() + 1, cell.y() + 1));
            case SOUTH -> new EdgeVertices(new Point2i(cell.x(), cell.y() + 1), new Point2i(cell.x() + 1, cell.y() + 1));
            case WEST  -> new EdgeVertices(new Point2i(cell.x(), cell.y()), new Point2i(cell.x(), cell.y() + 1));
        };
    }

    public static RoomShape roomShape(DungeonLayout layout, DungeonRoom room) {
        Objects.requireNonNull(layout, "layout");
        Objects.requireNonNull(room, "room");
        if (room.roomId() == null) {
            throw new IllegalArgumentException("roomId darf nicht null sein");
        }
        // Room geometry is always derived from the owning cluster component.
        return Objects.requireNonNull(layout.roomShape(room.roomId()),
                () -> "Raum " + room.roomId() + " hat keine Cluster-Geometrie");
    }

    public static Point2i roomCenter(DungeonLayout layout, DungeonRoom room) {
        return roomShape(layout, room).center();
    }
}
