package features.world.dungeon.model.structures.room;

import features.world.dungeon.geometry.CardinalDirection;
import features.world.dungeon.geometry.GridPoint;

public record RoomExitNarration(
        int levelZ,
        GridPoint roomCell,
        CardinalDirection direction,
        String description
) {
    public RoomExitNarration {
        roomCell = roomCell == null ? GridPoint.cell(0, 0, 0) : roomCell;
        direction = direction == null ? CardinalDirection.defaultDirection() : direction;
        description = description == null ? "" : description.trim();
    }
}
