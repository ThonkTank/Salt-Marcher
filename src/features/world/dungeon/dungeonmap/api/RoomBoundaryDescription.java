package features.world.dungeon.dungeonmap.api;

import features.world.dungeon.geometry.CardinalDirection;
import features.world.dungeon.geometry.GridPoint;
import features.world.dungeon.model.structures.room.Room;

import java.util.Objects;

public record RoomBoundaryDescription(
        Long clusterId,
        Room room,
        GridPoint roomCell,
        CardinalDirection outwardDirection,
        boolean exterior
) {
    public RoomBoundaryDescription {
        room = Objects.requireNonNull(room, "room");
        roomCell = Objects.requireNonNull(roomCell, "roomCell");
        outwardDirection = Objects.requireNonNull(outwardDirection, "outwardDirection");
    }
}
