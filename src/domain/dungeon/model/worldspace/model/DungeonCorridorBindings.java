package src.domain.dungeon.model.worldspace.model;

import java.util.ArrayList;
import java.util.List;
import src.domain.dungeon.model.core.model.component.CorridorDoorBinding;
import src.domain.dungeon.model.core.model.component.CorridorWaypoint;
import src.domain.dungeon.model.core.model.structure.CorridorBindings;
import src.domain.dungeon.model.core.model.structure.CorridorRoomSet;

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
        CorridorBindings empty = CorridorBindings.empty();
        return new DungeonCorridorBindings(worldspaceWaypoints(empty.waypoints()), List.of(), List.of(), List.of());
    }

    public DungeonCorridorBindings withDoorBinding(DungeonCorridorDoorBinding binding) {
        if (binding == null) {
            return this;
        }
        CorridorBindings updatedCore = coreBindings().withDoorBinding(binding.toCore());
        return new DungeonCorridorBindings(
                waypoints,
                doorBindingsFromCore(updatedCore.doorBindings(), binding),
                anchorBindings,
                anchorRefs);
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

    public DungeonCorridorBindings withWaypoints(List<DungeonCorridorWaypoint> nextWaypoints) {
        return new DungeonCorridorBindings(
                worldspaceWaypoints(coreWaypoints(nextWaypoints)),
                doorBindings,
                anchorBindings,
                anchorRefs);
    }

    public DungeonCorridorBindings replaceAnchorBindings(List<DungeonCorridorAnchorBinding> updatedBindings) {
        return new DungeonCorridorBindings(waypoints, doorBindings, updatedBindings, anchorRefs);
    }

    public DungeonCorridorBindings replaceAnchorRefs(List<DungeonCorridorAnchorRef> updatedRefs) {
        return new DungeonCorridorBindings(waypoints, doorBindings, anchorBindings, updatedRefs);
    }

    public DungeonCorridorBindings sanitizedForRooms(List<Long> roomIds) {
        CorridorRoomSet rooms = new CorridorRoomSet(roomIds);
        if (rooms.roomIds().isEmpty()) {
            return empty();
        }
        CorridorBindings sanitizedCore = coreBindings().sanitizedForRooms(rooms);
        return new DungeonCorridorBindings(
                worldspaceWaypoints(sanitizedCore.waypoints()),
                doorBindingsFromCore(sanitizedCore.doorBindings(), null),
                nonNullAnchorBindings(),
                nonNullAnchorRefs());
    }

    private CorridorBindings coreBindings() {
        return new CorridorBindings(coreWaypoints(waypoints), coreDoorBindings(doorBindings));
    }

    private List<DungeonCorridorDoorBinding> doorBindingsFromCore(
            List<CorridorDoorBinding> coreDoors,
            DungeonCorridorDoorBinding replacementBinding
    ) {
        List<DungeonCorridorDoorBinding> remaining = nonNullDoorBindings();
        List<DungeonCorridorDoorBinding> result = new ArrayList<>(coreDoors.size());
        for (CorridorDoorBinding coreDoor : coreDoors) {
            DungeonCorridorDoorBinding binding = replacementOrExistingDoorBinding(coreDoor, replacementBinding, remaining);
            if (binding != null) {
                result.add(binding);
            }
        }
        return List.copyOf(result);
    }

    private List<DungeonCorridorDoorBinding> nonNullDoorBindings() {
        List<DungeonCorridorDoorBinding> result = new ArrayList<>();
        for (DungeonCorridorDoorBinding binding : doorBindings) {
            if (binding != null) {
                result.add(binding);
            }
        }
        return result;
    }

    private static DungeonCorridorDoorBinding replacementOrExistingDoorBinding(
            CorridorDoorBinding coreDoor,
            DungeonCorridorDoorBinding replacementBinding,
            List<DungeonCorridorDoorBinding> remaining
    ) {
        if (replacementBinding != null && coreDoor.roomId() == replacementBinding.roomId()) {
            return replacementBinding;
        }
        return matchingExistingDoorBinding(coreDoor, remaining);
    }

    private static DungeonCorridorDoorBinding matchingExistingDoorBinding(
            CorridorDoorBinding coreDoor,
            List<DungeonCorridorDoorBinding> remaining
    ) {
        for (int index = 0; index < remaining.size(); index++) {
            DungeonCorridorDoorBinding candidate = remaining.get(index);
            if (candidate.toCore().equals(coreDoor)) {
                return remaining.remove(index);
            }
        }
        return null;
    }

    private static List<CorridorWaypoint> coreWaypoints(List<DungeonCorridorWaypoint> waypoints) {
        List<CorridorWaypoint> result = new ArrayList<>();
        for (DungeonCorridorWaypoint waypoint : waypoints == null ? List.<DungeonCorridorWaypoint>of() : waypoints) {
            if (waypoint != null) {
                result.add(waypoint.toCore());
            }
        }
        return List.copyOf(result);
    }

    private static List<CorridorDoorBinding> coreDoorBindings(List<DungeonCorridorDoorBinding> doorBindings) {
        List<CorridorDoorBinding> result = new ArrayList<>();
        for (DungeonCorridorDoorBinding binding : doorBindings) {
            if (binding != null) {
                result.add(binding.toCore());
            }
        }
        return List.copyOf(result);
    }

    private static List<DungeonCorridorWaypoint> worldspaceWaypoints(List<CorridorWaypoint> waypoints) {
        List<DungeonCorridorWaypoint> result = new ArrayList<>();
        for (CorridorWaypoint waypoint : waypoints) {
            result.add(DungeonCorridorWaypoint.fromCore(waypoint));
        }
        return List.copyOf(result);
    }

    private List<DungeonCorridorAnchorBinding> nonNullAnchorBindings() {
        List<DungeonCorridorAnchorBinding> sanitizedAnchors = new ArrayList<>();
        for (DungeonCorridorAnchorBinding binding : anchorBindings) {
            if (binding != null) {
                sanitizedAnchors.add(binding);
            }
        }
        return sanitizedAnchors;
    }

    private List<DungeonCorridorAnchorRef> nonNullAnchorRefs() {
        List<DungeonCorridorAnchorRef> sanitizedRefs = new ArrayList<>();
        for (DungeonCorridorAnchorRef ref : anchorRefs) {
            if (ref != null) {
                sanitizedRefs.add(ref);
            }
        }
        return sanitizedRefs;
    }
}
