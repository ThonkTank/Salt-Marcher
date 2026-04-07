package features.world.dungeonmap.model.structures.room;

import features.world.dungeonmap.geometry.CardinalDirection;
import features.world.dungeonmap.geometry.GridPoint;

public record RoomExitNarration(
        int levelZ,
        GridPoint roomCell,
        CardinalDirection direction,
        String description
) {
    public RoomExitNarration {
        roomCell = roomCell == null ? new GridPoint(0, 0) : roomCell;
        direction = direction == null ? CardinalDirection.defaultDirection() : direction;
        description = description == null ? "" : description.trim();
    }
}
