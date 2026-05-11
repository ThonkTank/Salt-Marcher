package src.domain.dungeon.model.map.model;

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
