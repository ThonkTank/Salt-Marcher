package features.dungeon.domain.core.structure.corridor;

/**
 * Typed corridor deletion target owned by the core corridor structure.
 */
public record CorridorDeletionTarget(
        TargetType targetType,
        long corridorId,
        long topologyRefId,
        long roomId,
        int waypointIndex
) {
    private enum TargetType {
        WHOLE_CORRIDOR,
        DOOR_BINDING,
        CORRIDOR_ANCHOR,
        CORRIDOR_WAYPOINT
    }

    public CorridorDeletionTarget {
        targetType = targetType == null ? TargetType.WHOLE_CORRIDOR : targetType;
        corridorId = Math.max(0L, corridorId);
        topologyRefId = Math.max(0L, topologyRefId);
        roomId = Math.max(0L, roomId);
        waypointIndex = Math.max(0, waypointIndex);
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
