package features.world.dungeonmap.model.structures.traversal;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

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

    public TraversalBindings withInsertedWaypoint(int index, TraversalWaypointBinding waypoint) {
        if (waypoint == null) {
            return this;
        }
        List<TraversalWaypointBinding> updated = new ArrayList<>(waypoints);
        updated.add(Math.max(0, Math.min(index, updated.size())), waypoint);
        return new TraversalBindings(updated, doorBindings);
    }

    public TraversalBindings withMovedWaypoint(int index, TraversalWaypointBinding waypoint) {
        if (waypoint == null || index < 0 || index >= waypoints.size()) {
            return this;
        }
        List<TraversalWaypointBinding> updated = new ArrayList<>(waypoints);
        updated.set(index, waypoint);
        return new TraversalBindings(updated, doorBindings);
    }

    public TraversalBindings withRemovedWaypoint(int index) {
        if (index < 0 || index >= waypoints.size()) {
            return this;
        }
        List<TraversalWaypointBinding> updated = new ArrayList<>(waypoints);
        updated.remove(index);
        return new TraversalBindings(updated, doorBindings);
    }

    public TraversalBindings withDoorBinding(TraversalDoorBinding binding) {
        if (binding == null) {
            return this;
        }
        List<TraversalDoorBinding> updated = new ArrayList<>(doorBindings.stream()
                .filter(existing -> existing == null || existing.roomId() != binding.roomId())
                .toList());
        updated.add(binding);
        return new TraversalBindings(waypoints, updated);
    }

    public TraversalBindings withoutDoorBinding(Long roomId) {
        if (roomId == null || doorBindings.isEmpty()) {
            return this;
        }
        List<TraversalDoorBinding> updated = doorBindings.stream()
                .filter(existing -> existing == null || !Objects.equals(existing.roomId(), roomId))
                .toList();
        return updated.size() == doorBindings.size() ? this : new TraversalBindings(waypoints, updated);
    }
}
