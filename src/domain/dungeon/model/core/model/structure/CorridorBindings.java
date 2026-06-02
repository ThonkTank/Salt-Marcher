package src.domain.dungeon.model.core.model.structure;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import src.domain.dungeon.model.core.model.component.CorridorAnchor;
import src.domain.dungeon.model.core.model.component.CorridorAnchorRef;
import src.domain.dungeon.model.core.model.component.CorridorDoorBinding;
import src.domain.dungeon.model.core.model.component.CorridorWaypoint;

public record CorridorBindings(
        List<CorridorWaypoint> waypoints,
        List<CorridorDoorBinding> doorBindings,
        List<CorridorAnchor> anchorBindings,
        List<CorridorAnchorRef> anchorRefs
) {
    private static final long MISSING_ANCHOR_ID = 0L;

    public CorridorBindings {
        waypoints = waypoints == null ? List.of() : List.copyOf(waypoints);
        doorBindings = doorBindings == null ? List.of() : List.copyOf(doorBindings);
        anchorBindings = anchorBindings == null ? List.of() : List.copyOf(anchorBindings);
        anchorRefs = anchorRefs == null ? List.of() : List.copyOf(anchorRefs);
    }

    public static CorridorBindings empty() {
        return new CorridorBindings(List.of(), List.of(), List.of(), List.of());
    }

    @Override
    public List<CorridorWaypoint> waypoints() {
        return List.copyOf(waypoints);
    }

    @Override
    public List<CorridorDoorBinding> doorBindings() {
        return List.copyOf(doorBindings);
    }

    @Override
    public List<CorridorAnchor> anchorBindings() {
        return List.copyOf(anchorBindings);
    }

    @Override
    public List<CorridorAnchorRef> anchorRefs() {
        return List.copyOf(anchorRefs);
    }

    public CorridorBindings withDoorBinding(CorridorDoorBinding binding) {
        Objects.requireNonNull(binding);
        List<CorridorDoorBinding> updated = new ArrayList<>();
        for (CorridorDoorBinding existing : doorBindings) {
            if (existing.roomId() != binding.roomId()) {
                updated.add(existing);
            }
        }
        updated.add(binding);
        return new CorridorBindings(waypoints, updated, anchorBindings, anchorRefs);
    }

    public CorridorBindings withAnchorBinding(CorridorAnchor binding) {
        Objects.requireNonNull(binding);
        if (binding.anchorId() <= MISSING_ANCHOR_ID) {
            return this;
        }
        List<CorridorAnchor> updated = new ArrayList<>();
        for (CorridorAnchor existing : anchorBindings) {
            if (existing.anchorId() != binding.anchorId()) {
                updated.add(existing);
            }
        }
        updated.add(binding);
        return new CorridorBindings(waypoints, doorBindings, updated, anchorRefs);
    }

    public CorridorBindings withAnchorRef(CorridorAnchorRef ref) {
        Objects.requireNonNull(ref);
        if (!ref.present()) {
            return this;
        }
        List<CorridorAnchorRef> updated = new ArrayList<>();
        for (CorridorAnchorRef existing : anchorRefs) {
            if (existing.anchorId() != ref.anchorId()) {
                updated.add(existing);
            }
        }
        updated.add(ref);
        return new CorridorBindings(waypoints, doorBindings, anchorBindings, updated);
    }

    public CorridorBindings withoutAnchorRef(long anchorId) {
        if (anchorId <= MISSING_ANCHOR_ID) {
            return this;
        }
        List<CorridorAnchorRef> updated = new ArrayList<>();
        for (CorridorAnchorRef ref : anchorRefs) {
            if (ref.anchorId() != anchorId) {
                updated.add(ref);
            }
        }
        return new CorridorBindings(waypoints, doorBindings, anchorBindings, updated);
    }

    public CorridorBindings withoutAnchorRefAndRouteWaypoints(long anchorId) {
        CorridorBindings updated = withoutAnchorRef(anchorId);
        return updated.equals(this) ? this : updated.withWaypoints(List.of());
    }

    public CorridorBindings withoutWaypoint(int waypointIndex) {
        if (waypointIndex < 0 || waypointIndex >= waypoints.size()) {
            return this;
        }
        List<CorridorWaypoint> updated = new ArrayList<>();
        for (int index = 0; index < waypoints.size(); index++) {
            if (index != waypointIndex) {
                updated.add(waypoints.get(index));
            }
        }
        return new CorridorBindings(updated, doorBindings, anchorBindings, anchorRefs);
    }

    public CorridorBindings withWaypoints(List<CorridorWaypoint> nextWaypoints) {
        return new CorridorBindings(nextWaypoints, doorBindings, anchorBindings, anchorRefs);
    }

    public CorridorBindings withAnchorBindings(List<CorridorAnchor> nextAnchorBindings) {
        return new CorridorBindings(waypoints, doorBindings, nextAnchorBindings, anchorRefs);
    }

    public CorridorBindings withAnchorRefs(List<CorridorAnchorRef> nextAnchorRefs) {
        return new CorridorBindings(waypoints, doorBindings, anchorBindings, nextAnchorRefs);
    }

    public CorridorBindings sanitizedForRooms(CorridorRoomSet rooms) {
        Objects.requireNonNull(rooms);
        if (rooms.roomIds().isEmpty()) {
            return empty();
        }
        List<CorridorDoorBinding> sanitizedDoors = new ArrayList<>();
        for (CorridorDoorBinding binding : doorBindings) {
            if (rooms.connects(binding.roomId())) {
                sanitizedDoors.add(binding);
            }
        }
        return new CorridorBindings(waypoints, sanitizedDoors, anchorBindings, anchorRefs);
    }
}
