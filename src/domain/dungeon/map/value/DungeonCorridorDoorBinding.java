package src.domain.dungeon.map.value;

public record DungeonCorridorDoorBinding(
        long roomId,
        long clusterId,
        DungeonCell relativeCell,
        DungeonEdgeDirection direction,
        DungeonTopologyRef topologyRef
) {

    public DungeonCorridorDoorBinding(
            long roomId,
            long clusterId,
            DungeonCell relativeCell,
            DungeonEdgeDirection direction
    ) {
        this(roomId, clusterId, relativeCell, direction, DungeonTopologyRef.empty());
    }

    public DungeonCorridorDoorBinding {
        relativeCell = relativeCell == null ? new DungeonCell(0, 0, 0) : relativeCell;
        direction = direction == null ? DungeonEdgeDirection.NORTH : direction;
        topologyRef = topologyRef == null ? DungeonTopologyRef.empty() : topologyRef;
    }
}
