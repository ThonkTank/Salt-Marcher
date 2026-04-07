package features.world.dungeon.dungeonmap.corridor.model;

import features.world.dungeon.geometry.GridPoint;

import java.util.Objects;

/**
 * Persisted authored shape control for one corridor member.
 */
public record CorridorWaypoint(
        Long waypointId,
        Long memberId,
        int waypointOrder,
        GridPoint point
) {
    public CorridorWaypoint {
        memberId = Objects.requireNonNull(memberId, "memberId");
        point = Objects.requireNonNull(point, "point");
        if (waypointOrder < 0) {
            throw new IllegalArgumentException("Corridor waypoint order must be non-negative");
        }
    }
}
