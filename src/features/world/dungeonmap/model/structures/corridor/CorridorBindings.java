package features.world.dungeonmap.model.structures.corridor;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

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

    public CorridorBindings withInsertedWaypoint(int index, CorridorWaypointBinding waypoint) {
        if (waypoint == null) {
            return this;
        }
        List<CorridorWaypointBinding> updated = new ArrayList<>(waypoints);
        updated.add(Math.max(0, Math.min(index, updated.size())), waypoint);
        return new CorridorBindings(updated, doorBindings);
    }

    public CorridorBindings withMovedWaypoint(int index, CorridorWaypointBinding waypoint) {
        if (waypoint == null || index < 0 || index >= waypoints.size()) {
            return this;
        }
        List<CorridorWaypointBinding> updated = new ArrayList<>(waypoints);
        updated.set(index, waypoint);
        return new CorridorBindings(updated, doorBindings);
    }

    public CorridorBindings withRemovedWaypoint(int index) {
        if (index < 0 || index >= waypoints.size()) {
            return this;
        }
        List<CorridorWaypointBinding> updated = new ArrayList<>(waypoints);
        updated.remove(index);
        return new CorridorBindings(updated, doorBindings);
    }

    public CorridorBindings withDoorBinding(CorridorDoorBinding binding) {
        if (binding == null) {
            return this;
        }
        List<CorridorDoorBinding> updated = new ArrayList<>(doorBindings.stream()
                .filter(existing -> existing == null || existing.roomId() != binding.roomId())
                .toList());
        updated.add(binding);
        return new CorridorBindings(waypoints, updated);
    }

    public CorridorBindings withoutDoorBinding(Long roomId) {
        if (roomId == null || doorBindings.isEmpty()) {
            return this;
        }
        List<CorridorDoorBinding> updated = doorBindings.stream()
                .filter(existing -> existing == null || !Objects.equals(existing.roomId(), roomId))
                .toList();
        return updated.size() == doorBindings.size() ? this : new CorridorBindings(waypoints, updated);
    }
}
