package features.dungeon.domain.core.structure.room;

import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Direction;

public record DungeonRoomExitDescription(
        Cell roomCell,
        Direction direction,
        String description
) {

    public DungeonRoomExitDescription {
        roomCell = roomCell == null ? new Cell(0, 0, 0) : roomCell;
        direction = direction == null ? Direction.NORTH : direction;
        description = description == null ? "" : description;
    }
}
