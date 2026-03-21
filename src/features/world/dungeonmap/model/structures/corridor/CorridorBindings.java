package features.world.dungeonmap.model.structures.corridor;

import java.util.List;

/**
 * Canonical editable corridor bindings.
 *
 * <p>Bindings stay relative and structure-specific. Absolute route and door geometry are always derived at
 * runtime from these bindings plus the current room/cluster layout.</p>
 */
public record CorridorBindings(
        List<CorridorWaypointBinding> waypoints,
        List<CorridorDoorBinding> doorBindings
) {
    public CorridorBindings {
        waypoints = waypoints == null ? List.of() : List.copyOf(waypoints);
        doorBindings = doorBindings == null ? List.of() : List.copyOf(doorBindings);
    }

    public static CorridorBindings empty() {
        return new CorridorBindings(List.of(), List.of());
    }
}
