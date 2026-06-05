package src.domain.dungeon.model.core.structure.room;

import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Direction;

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
