package src.domain.dungeon.model.worldspace;

import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Direction;
import src.domain.dungeon.model.core.graph.DungeonTopologyRef;

public record DungeonCorridorEndpoint(
        DungeonCorridorEndpointKind kind,
        long roomId,
        long clusterId,
        Cell roomCell,
        Direction direction,
        long hostCorridorId,
        Cell anchorCell,
        DungeonTopologyRef topologyRef
) {

    public DungeonCorridorEndpoint {
        kind = kind == null ? DungeonCorridorEndpointKind.EMPTY : kind;
        roomId = Math.max(0L, roomId);
        clusterId = Math.max(0L, clusterId);
        roomCell = roomCell == null ? new Cell(0, 0, 0) : roomCell;
        direction = direction == null ? Direction.NORTH : direction;
        hostCorridorId = Math.max(0L, hostCorridorId);
        anchorCell = anchorCell == null ? new Cell(0, 0, 0) : anchorCell;
        topologyRef = topologyRef == null ? DungeonTopologyRef.empty() : topologyRef;
    }

    public static DungeonCorridorEndpoint door(
            long roomId,
            long clusterId,
            Cell roomCell,
            Direction direction,
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
            Cell anchorCell,
            DungeonTopologyRef topologyRef
    ) {
        return new DungeonCorridorEndpoint(
                DungeonCorridorEndpointKind.ANCHOR,
                0L,
                0L,
                emptyCell(),
                Direction.NORTH,
                hostCorridorId,
                anchorCell,
                topologyRef);
    }

    private static Cell emptyCell() {
        return new Cell(0, 0, 0);
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
