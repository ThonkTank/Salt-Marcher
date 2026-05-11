package src.domain.dungeon.model.map.model;

public final class DungeonCorridorEndpoint {

    private final DungeonCorridorEndpointKind kind;
    private final long roomId;
    private final long clusterId;
    private final DungeonCell roomCell;
    private final DungeonEdgeDirection direction;
    private final long hostCorridorId;
    private final DungeonCell anchorCell;
    private final DungeonTopologyRef topologyRef;

    private DungeonCorridorEndpoint(
            DungeonCorridorEndpointKind kind,
            long roomId,
            long clusterId,
            DungeonCell roomCell,
            DungeonEdgeDirection direction,
            long hostCorridorId,
            DungeonCell anchorCell,
            DungeonTopologyRef topologyRef
    ) {
        this.kind = kind == null ? DungeonCorridorEndpointKind.EMPTY : kind;
        this.roomId = Math.max(0L, roomId);
        this.clusterId = Math.max(0L, clusterId);
        this.roomCell = roomCell == null ? new DungeonCell(0, 0, 0) : roomCell;
        this.direction = direction == null ? DungeonEdgeDirection.NORTH : direction;
        this.hostCorridorId = Math.max(0L, hostCorridorId);
        this.anchorCell = anchorCell == null ? new DungeonCell(0, 0, 0) : anchorCell;
        this.topologyRef = topologyRef == null ? DungeonTopologyRef.empty() : topologyRef;
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
                null,
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
                null,
                DungeonEdgeDirection.NORTH,
                hostCorridorId,
                anchorCell,
                topologyRef);
    }

    public boolean present() {
        if (isDoorEndpoint()) {
            return roomId > 0L && clusterId > 0L;
        }
        return isAnchorEndpoint() && hostCorridorId > 0L;
    }

    public DungeonCell corridorCell() {
        return isDoorEndpoint() ? direction.neighborOf(roomCell) : anchorCell;
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

    public long roomId() {
        return roomId;
    }

    public long clusterId() {
        return clusterId;
    }

    public DungeonCell roomCell() {
        return roomCell;
    }

    public DungeonEdgeDirection direction() {
        return direction;
    }

    public long hostCorridorId() {
        return hostCorridorId;
    }

    public DungeonCell anchorCell() {
        return anchorCell;
    }

    public DungeonTopologyRef topologyRef() {
        return topologyRef;
    }

    private enum DungeonCorridorEndpointKind {
        DOOR,
        ANCHOR,
        EMPTY
    }
}
