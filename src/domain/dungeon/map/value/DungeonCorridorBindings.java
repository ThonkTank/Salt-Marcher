package src.domain.dungeon.map.value;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

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
        List<DungeonCorridorDoorBinding> updated = new ArrayList<>(doorBindings.stream()
                .filter(existing -> existing == null || existing.roomId() != binding.roomId())
                .toList());
        updated.add(binding);
        return new DungeonCorridorBindings(waypoints, updated, anchorBindings, anchorRefs);
    }

    public DungeonCorridorBindings withoutDoorBinding(long roomId) {
        if (roomId <= 0L || doorBindings.isEmpty()) {
            return this;
        }
        List<DungeonCorridorDoorBinding> updated = doorBindings.stream()
                .filter(existing -> existing == null || existing.roomId() != roomId)
                .toList();
        return updated.size() == doorBindings.size()
                ? this
                : new DungeonCorridorBindings(waypoints, updated, anchorBindings, anchorRefs);
    }

    public DungeonCorridorBindings withAnchorBinding(DungeonCorridorAnchorBinding binding) {
        if (binding == null || !binding.topologyRef().present()) {
            return this;
        }
        List<DungeonCorridorAnchorBinding> updated = new ArrayList<>(anchorBindings.stream()
                .filter(existing -> existing != null && !existing.topologyRef().equals(binding.topologyRef()))
                .toList());
        updated.add(binding);
        return new DungeonCorridorBindings(waypoints, doorBindings, updated, anchorRefs);
    }

    public DungeonCorridorBindings withAnchorRef(DungeonCorridorAnchorRef ref) {
        if (ref == null || !ref.present()) {
            return this;
        }
        List<DungeonCorridorAnchorRef> updated = new ArrayList<>(anchorRefs.stream()
                .filter(existing -> existing != null && !existing.topologyRef().equals(ref.topologyRef()))
                .toList());
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
        List<DungeonCorridorDoorBinding> sanitizedDoors = doorBindings.stream()
                .filter(Objects::nonNull)
                .filter(binding -> roomIds.contains(binding.roomId()))
                .toList();
        List<DungeonCorridorAnchorBinding> sanitizedAnchors = anchorBindings.stream()
                .filter(Objects::nonNull)
                .toList();
        List<DungeonCorridorAnchorRef> sanitizedRefs = anchorRefs.stream()
                .filter(Objects::nonNull)
                .toList();
        return new DungeonCorridorBindings(waypoints, sanitizedDoors, sanitizedAnchors, sanitizedRefs);
    }
}
