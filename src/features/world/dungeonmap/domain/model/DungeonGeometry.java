package features.world.dungeonmap.domain.model;

import java.util.Objects;

public final class DungeonGeometry {

    private DungeonGeometry() {
        throw new AssertionError("No instances");
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
