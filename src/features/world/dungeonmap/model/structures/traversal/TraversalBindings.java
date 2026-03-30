package features.world.dungeonmap.model.structures.traversal;

import java.util.List;

/**
 * Canonical editable traversal constraints.
 *
 * <p>Constraints stay relative and structure-specific. Absolute route and door geometry are always derived at
 * runtime from these bindings plus the current room/cluster layout.</p>
 */
public record TraversalBindings(
        List<TraversalWaypointBinding> waypoints,
        List<TraversalDoorBinding> doorBindings
) {
    public TraversalBindings {
        waypoints = waypoints == null ? List.of() : List.copyOf(waypoints);
        doorBindings = doorBindings == null ? List.of() : List.copyOf(doorBindings);
    }

    public static TraversalBindings empty() {
        return new TraversalBindings(List.of(), List.of());
    }
}
