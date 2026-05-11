package src.domain.dungeon.model.map.model;

import java.util.ArrayList;
import java.util.List;

public record DungeonCorridorBindings(
        List<DungeonCorridorWaypoint> waypoints,
        List<DungeonCorridorDoorBinding> doorBindings,
        List<DungeonCorridorAnchorBinding> anchorBindings,
        List<DungeonCorridorAnchorRef> anchorRefs
) {

    public DungeonCorridorBindings {
        waypoints = waypoints == null ? List.of() : List.copyOf(waypoints);
        doorBindings = doorBindings == null ? List.of() : List.copyOf(doorBindings);
        anchorBindings = anchorBindings == null ? List.of() : List.copyOf(anchorBindings);
        anchorRefs = anchorRefs == null ? List.of() : List.copyOf(anchorRefs);
    }

    public static DungeonCorridorBindings empty() {
        return new DungeonCorridorBindings(List.of(), List.of(), List.of(), List.of());
    }

    public DungeonCorridorBindings withDoorBinding(DungeonCorridorDoorBinding binding) {
        if (binding == null) {
            return this;
        }
        List<DungeonCorridorDoorBinding> updated = new ArrayList<>();
        for (DungeonCorridorDoorBinding existing : doorBindings) {
            if (existing == null || existing.roomId() != binding.roomId()) {
                updated.add(existing);
            }
        }
        updated.add(binding);
        return new DungeonCorridorBindings(waypoints, updated, anchorBindings, anchorRefs);
    }

    public DungeonCorridorBindings withoutDoorBinding(long roomId) {
        if (roomId <= 0L || doorBindings.isEmpty()) {
            return this;
        }
        List<DungeonCorridorDoorBinding> updated = new ArrayList<>();
        for (DungeonCorridorDoorBinding existing : doorBindings) {
            if (existing == null || existing.roomId() != roomId) {
                updated.add(existing);
            }
        }
        return updated.size() == doorBindings.size()
                ? this
                : new DungeonCorridorBindings(waypoints, updated, anchorBindings, anchorRefs);
    }

    public DungeonCorridorBindings withAnchorBinding(DungeonCorridorAnchorBinding binding) {
        if (binding == null || !binding.topologyRef().present()) {
            return this;
        }
        List<DungeonCorridorAnchorBinding> updated = new ArrayList<>();
        for (DungeonCorridorAnchorBinding existing : anchorBindings) {
            if (existing != null && !existing.topologyRef().equals(binding.topologyRef())) {
                updated.add(existing);
            }
        }
        updated.add(binding);
        return new DungeonCorridorBindings(waypoints, doorBindings, updated, anchorRefs);
    }

    public DungeonCorridorBindings withAnchorRef(DungeonCorridorAnchorRef ref) {
        if (ref == null || !ref.present()) {
            return this;
        }
        List<DungeonCorridorAnchorRef> updated = new ArrayList<>();
        for (DungeonCorridorAnchorRef existing : anchorRefs) {
            if (existing != null && !existing.topologyRef().equals(ref.topologyRef())) {
                updated.add(existing);
            }
        }
        updated.add(ref);
        return new DungeonCorridorBindings(waypoints, doorBindings, anchorBindings, updated);
    }

    public DungeonCorridorBindings replaceAnchorBindings(List<DungeonCorridorAnchorBinding> updatedBindings) {
        return new DungeonCorridorBindings(waypoints, doorBindings, updatedBindings, anchorRefs);
    }

    public DungeonCorridorBindings replaceAnchorRefs(List<DungeonCorridorAnchorRef> updatedRefs) {
        return new DungeonCorridorBindings(waypoints, doorBindings, anchorBindings, updatedRefs);
    }

    public DungeonCorridorBindings mergedKeepingThis(DungeonCorridorBindings other, List<Long> keptRoomIds) {
        if (other == null || this.equals(other)) {
            return sanitizedForRooms(keptRoomIds);
        }
        return sanitizedForRooms(keptRoomIds);
    }

    public DungeonCorridorBindings sanitizedForRooms(List<Long> roomIds) {
        if (roomIds == null || roomIds.isEmpty()) {
            return empty();
        }
        List<DungeonCorridorDoorBinding> sanitizedDoors = new ArrayList<>();
        for (DungeonCorridorDoorBinding binding : doorBindings) {
            if (binding != null && roomIds.contains(binding.roomId())) {
                sanitizedDoors.add(binding);
            }
        }
        List<DungeonCorridorAnchorBinding> sanitizedAnchors = new ArrayList<>();
        for (DungeonCorridorAnchorBinding binding : anchorBindings) {
            if (binding != null) {
                sanitizedAnchors.add(binding);
            }
        }
        List<DungeonCorridorAnchorRef> sanitizedRefs = new ArrayList<>();
        for (DungeonCorridorAnchorRef ref : anchorRefs) {
            if (ref != null) {
                sanitizedRefs.add(ref);
            }
        }
        return new DungeonCorridorBindings(waypoints, sanitizedDoors, sanitizedAnchors, sanitizedRefs);
    }
}
