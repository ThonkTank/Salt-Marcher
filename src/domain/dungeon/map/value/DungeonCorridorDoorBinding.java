package src.domain.dungeon.map.value;

public record DungeonCorridorDoorBinding(
        long roomId,
        long clusterId,
        DungeonCell relativeCell,
        DungeonEdgeDirection direction
) {

    public DungeonCorridorDoorBinding {
        relativeCell = relativeCell == null ? new DungeonCell(0, 0, 0) : relativeCell;
        direction = direction == null ? DungeonEdgeDirection.NORTH : direction;
    }
}
