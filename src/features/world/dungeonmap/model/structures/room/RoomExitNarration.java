package features.world.dungeonmap.model.structures.room;

import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.CellCoord;

public record RoomExitNarration(
        int levelZ,
        CellCoord roomCell,
        CardinalDirection direction,
        String description
) {
    public RoomExitNarration {
        roomCell = roomCell == null ? new CellCoord(0, 0) : roomCell;
        direction = direction == null ? CardinalDirection.defaultDirection() : direction;
        description = description == null ? "" : description.trim();
    }
}
