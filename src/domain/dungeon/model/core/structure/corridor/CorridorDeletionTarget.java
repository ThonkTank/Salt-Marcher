package src.domain.dungeon.model.core.structure.corridor;

/**
 * Typed corridor deletion target owned by the core corridor structure.
 */
public final class CorridorDeletionTarget {
    private enum TargetType {
        WHOLE_CORRIDOR,
        DOOR_BINDING,
        CORRIDOR_ANCHOR,
        CORRIDOR_WAYPOINT
    }

    private final TargetType targetType;
    private final long corridorId;
    private final long topologyRefId;
    private final long roomId;
    private final int waypointIndex;

    private CorridorDeletionTarget(
            TargetType targetType,
            long corridorId,
            long topologyRefId,
            long roomId,
            int waypointIndex
    ) {
        this.targetType = targetType == null ? TargetType.WHOLE_CORRIDOR : targetType;
        this.corridorId = Math.max(0L, corridorId);
        this.topologyRefId = Math.max(0L, topologyRefId);
        this.roomId = Math.max(0L, roomId);
        this.waypointIndex = Math.max(0, waypointIndex);
    }

    public long corridorId() {
        return corridorId;
    }

    public long topologyRefId() {
        return topologyRefId;
    }

    public long roomId() {
        return roomId;
    }

    public int waypointIndex() {
        return waypointIndex;
    }

    public boolean hasCorridor() {
        return corridorId() > 0L;
    }

    public static CorridorDeletionTarget wholeCorridor(long corridorId) {
        return new CorridorDeletionTarget(TargetType.WHOLE_CORRIDOR, corridorId, 0L, 0L, 0);
    }

    public static CorridorDeletionTarget doorBinding(long corridorId, long topologyRefId, long roomId) {
        return new CorridorDeletionTarget(TargetType.DOOR_BINDING, corridorId, topologyRefId, roomId, 0);
    }

    public static CorridorDeletionTarget corridorAnchor(long corridorId, long topologyRefId) {
        return new CorridorDeletionTarget(TargetType.CORRIDOR_ANCHOR, corridorId, topologyRefId, 0L, 0);
    }

    public static CorridorDeletionTarget corridorWaypoint(long corridorId, int waypointIndex) {
        return new CorridorDeletionTarget(TargetType.CORRIDOR_WAYPOINT, corridorId, 0L, 0L, waypointIndex);
    }

    public boolean wholeCorridor() {
        return targetType == TargetType.WHOLE_CORRIDOR;
    }

    public boolean doorBinding() {
        return targetType == TargetType.DOOR_BINDING;
    }

    public boolean corridorAnchor() {
        return targetType == TargetType.CORRIDOR_ANCHOR;
    }

    public boolean corridorWaypoint() {
        return targetType == TargetType.CORRIDOR_WAYPOINT;
    }

}
