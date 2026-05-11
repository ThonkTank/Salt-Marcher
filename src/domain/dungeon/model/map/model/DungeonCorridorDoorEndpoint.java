package src.domain.dungeon.model.map.model;

public record DungeonCorridorDoorEndpoint(
        long roomId,
        long clusterId,
        DungeonCell roomCell,
        DungeonEdgeDirection direction,
        DungeonTopologyRef topologyRef
) {

    public DungeonCorridorDoorEndpoint {
        roomId = Math.max(0L, roomId);
        clusterId = Math.max(0L, clusterId);
        roomCell = roomCell == null ? new DungeonCell(0, 0, 0) : roomCell;
        direction = direction == null ? DungeonEdgeDirection.NORTH : direction;
        topologyRef = topologyRef == null ? DungeonTopologyRef.empty() : topologyRef;
    }

    public boolean present() {
        return roomId > 0L && clusterId > 0L;
    }

    public DungeonCell corridorCell() {
        return direction.neighborOf(roomCell);
    }

    public int level() {
        return roomCell.level();
    }
}
