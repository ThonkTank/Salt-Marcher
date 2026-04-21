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

    public DungeonCell absoluteRoomCell(DungeonCell clusterCenter) {
        DungeonCell center = clusterCenter == null ? new DungeonCell(0, 0, relativeCell.level()) : clusterCenter;
        return new DungeonCell(
                center.q() + relativeCell.q(),
                center.r() + relativeCell.r(),
                center.level());
    }

    public DungeonCell absoluteCorridorCell(DungeonCell clusterCenter) {
        return direction.neighborOf(absoluteRoomCell(clusterCenter));
    }

    public DungeonEdge absoluteDoorEdge(DungeonCell clusterCenter) {
        DungeonCell roomCell = absoluteRoomCell(clusterCenter);
        return new DungeonEdge(roomCell, direction.neighborOf(roomCell));
    }
}
