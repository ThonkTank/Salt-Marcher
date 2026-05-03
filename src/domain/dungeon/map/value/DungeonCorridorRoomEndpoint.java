package src.domain.dungeon.map.value;

public record DungeonCorridorRoomEndpoint(
        long roomId,
        long clusterId,
        boolean fixedDoor,
        DungeonCell roomCell,
        DungeonEdgeDirection direction,
        DungeonTopologyRef topologyRef
) {

    public DungeonCorridorRoomEndpoint {
        roomId = Math.max(0L, roomId);
        clusterId = Math.max(0L, clusterId);
        roomCell = roomCell == null ? new DungeonCell(0, 0, 0) : roomCell;
        direction = direction == null ? DungeonEdgeDirection.NORTH : direction;
        topologyRef = topologyRef == null ? DungeonTopologyRef.empty() : topologyRef;
    }

    public boolean present() {
        return roomId > 0L && clusterId > 0L;
    }

    public DungeonCorridorDoorBinding toDoorBinding(DungeonCell clusterCenter) {
        DungeonCell center = clusterCenter == null ? new DungeonCell(0, 0, roomCell.level()) : clusterCenter;
        return new DungeonCorridorDoorBinding(
                roomId,
                clusterId,
                new DungeonCell(
                        roomCell.q() - center.q(),
                        roomCell.r() - center.r(),
                        roomCell.level()),
                direction,
                topologyRef);
    }
}
