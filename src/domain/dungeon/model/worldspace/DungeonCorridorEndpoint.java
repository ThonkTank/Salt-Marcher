package src.domain.dungeon.model.worldspace;

public record DungeonCorridorEndpoint(
        DungeonCorridorEndpointKind kind,
        long roomId,
        long clusterId,
        DungeonCell roomCell,
        DungeonEdgeDirection direction,
        long hostCorridorId,
        DungeonCell anchorCell,
        DungeonTopologyRef topologyRef
) {

    public DungeonCorridorEndpoint {
        kind = kind == null ? DungeonCorridorEndpointKind.EMPTY : kind;
        roomId = Math.max(0L, roomId);
        clusterId = Math.max(0L, clusterId);
        roomCell = roomCell == null ? new DungeonCell(0, 0, 0) : roomCell;
        direction = direction == null ? DungeonEdgeDirection.NORTH : direction;
        hostCorridorId = Math.max(0L, hostCorridorId);
        anchorCell = anchorCell == null ? new DungeonCell(0, 0, 0) : anchorCell;
        topologyRef = topologyRef == null ? DungeonTopologyRef.empty() : topologyRef;
    }

    public static DungeonCorridorEndpoint door(
            long roomId,
            long clusterId,
            DungeonCell roomCell,
            DungeonEdgeDirection direction,
            DungeonTopologyRef topologyRef
    ) {
        return new DungeonCorridorEndpoint(
                DungeonCorridorEndpointKind.DOOR,
                roomId,
                clusterId,
                roomCell,
                direction,
                0L,
                emptyCell(),
                topologyRef);
    }

    public static DungeonCorridorEndpoint anchor(
            long hostCorridorId,
            DungeonCell anchorCell,
            DungeonTopologyRef topologyRef
    ) {
        return new DungeonCorridorEndpoint(
                DungeonCorridorEndpointKind.ANCHOR,
                0L,
                0L,
                emptyCell(),
                DungeonEdgeDirection.NORTH,
                hostCorridorId,
                anchorCell,
                topologyRef);
    }

    private static DungeonCell emptyCell() {
        return new DungeonCell(0, 0, 0);
    }

    public boolean present() {
        if (isDoorEndpoint()) {
            return roomId > 0L && clusterId > 0L;
        }
        return isAnchorEndpoint() && hostCorridorId > 0L;
    }

    public int level() {
        return isDoorEndpoint() ? roomCell.level() : anchorCell.level();
    }

    public boolean sameLevelAs(DungeonCorridorEndpoint other) {
        return other != null && level() == other.level();
    }

    public boolean isDoorEndpoint() {
        return kind == DungeonCorridorEndpointKind.DOOR;
    }

    public boolean isAnchorEndpoint() {
        return kind == DungeonCorridorEndpointKind.ANCHOR;
    }

    public enum DungeonCorridorEndpointKind {
        DOOR,
        ANCHOR,
        EMPTY
    }
}
