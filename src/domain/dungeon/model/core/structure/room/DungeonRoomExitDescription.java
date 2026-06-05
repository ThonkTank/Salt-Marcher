package src.domain.dungeon.model.core.structure.room;

import src.domain.dungeon.model.worldspace.DungeonCell;
import src.domain.dungeon.model.worldspace.DungeonEdgeDirection;

public record DungeonRoomExitDescription(
        DungeonCell roomCell,
        DungeonEdgeDirection direction,
        String description
) {

    public DungeonRoomExitDescription {
        roomCell = roomCell == null ? new DungeonCell(0, 0, 0) : roomCell;
        direction = direction == null ? DungeonEdgeDirection.NORTH : direction;
        description = description == null ? "" : description;
    }
}
