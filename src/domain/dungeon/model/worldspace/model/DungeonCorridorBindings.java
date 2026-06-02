package src.domain.dungeon.model.worldspace.model;

import java.util.ArrayList;
import java.util.List;
import src.domain.dungeon.model.core.model.component.CorridorAnchor;
import src.domain.dungeon.model.core.model.component.CorridorAnchorRef;
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
        return new DungeonCorridorBindings(
                worldspaceWaypoints(empty.waypoints()),
                List.of(),
                worldspaceAnchorBindings(empty.anchorBindings(), List.of()),
                worldspaceAnchorRefs(empty.anchorRefs(), List.of()));
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

    public DungeonCorridorBindings withoutDoorBindingForRoom(long roomId) {
        return withCoreBindings(coreBindings().withoutDoorBindingForRoom(roomId), null);
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
        CorridorBindings updatedCore = new CorridorBindings(
                coreWaypoints(waypoints),
                coreDoorBindings(doorBindings),
                coreAnchorBindings(updated),
                coreAnchorRefs(anchorRefs))
                .withAnchorBinding(binding.toCore());
        updated.add(binding);
        return new DungeonCorridorBindings(
                waypoints,
                doorBindings,
                worldspaceAnchorBindings(updatedCore.anchorBindings(), updated),
                anchorRefs);
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
        CorridorBindings updatedCore = new CorridorBindings(
                coreWaypoints(waypoints),
                coreDoorBindings(doorBindings),
                coreAnchorBindings(anchorBindings),
                coreAnchorRefs(updated))
                .withAnchorRef(ref.toCore());
        updated.add(ref);
        return new DungeonCorridorBindings(
                waypoints,
                doorBindings,
                anchorBindings,
                worldspaceAnchorRefs(updatedCore.anchorRefs(), updated));
    }

    public DungeonCorridorBindings withWaypoints(List<DungeonCorridorWaypoint> nextWaypoints) {
        CorridorBindings updatedCore = coreBindings().withWaypoints(coreWaypoints(nextWaypoints));
        return withCoreBindings(updatedCore, null);
    }

    public List<DungeonCorridorWaypoint> waypointsBetweenEndpointIndexes(int firstIndex, int secondIndex) {
        return worldspaceWaypoints(coreBindings().waypointsBetweenEndpointIndexes(firstIndex, secondIndex));
    }

    public DungeonCorridorBindings withoutAnchorRefAndRouteWaypoints(long anchorId) {
        return withCoreBindings(coreBindings().withoutAnchorRefAndRouteWaypoints(anchorId), null);
    }

    public DungeonCorridorBindings withoutWaypoint(int waypointIndex) {
        return withCoreBindings(coreBindings().withoutWaypoint(waypointIndex), null);
    }

    public DungeonCorridorBindings replaceAnchorBindings(List<DungeonCorridorAnchorBinding> updatedBindings) {
        CorridorBindings updatedCore = coreBindings().withAnchorBindings(coreAnchorBindings(updatedBindings));
        return new DungeonCorridorBindings(
                waypoints,
                doorBindings,
                worldspaceAnchorBindings(updatedCore.anchorBindings(), updatedBindings),
                anchorRefs);
    }

    public DungeonCorridorBindings replaceAnchorRefs(List<DungeonCorridorAnchorRef> updatedRefs) {
        CorridorBindings updatedCore = coreBindings().withAnchorRefs(coreAnchorRefs(updatedRefs));
        return new DungeonCorridorBindings(
                waypoints,
                doorBindings,
                anchorBindings,
                worldspaceAnchorRefs(updatedCore.anchorRefs(), updatedRefs));
    }

    public DungeonCorridorBindings sanitizedForRooms(List<Long> roomIds) {
        CorridorRoomSet rooms = new CorridorRoomSet(roomIds);
        if (rooms.roomIds().isEmpty()) {
            return empty();
        }
        CorridorBindings sanitizedCore = coreBindings().sanitizedForRooms(rooms);
        return withCoreBindings(sanitizedCore, null);
    }

    private CorridorBindings coreBindings() {
        return new CorridorBindings(
                coreWaypoints(waypoints),
                coreDoorBindings(doorBindings),
                coreAnchorBindings(anchorBindings),
                coreAnchorRefs(anchorRefs));
    }

    private DungeonCorridorBindings withCoreBindings(
            CorridorBindings coreBindings,
            DungeonCorridorDoorBinding replacementDoor
    ) {
        return new DungeonCorridorBindings(
                worldspaceWaypoints(coreBindings.waypoints()),
                doorBindingsFromCore(coreBindings.doorBindings(), replacementDoor),
                worldspaceAnchorBindings(coreBindings.anchorBindings(), anchorBindings),
                worldspaceAnchorRefs(coreBindings.anchorRefs(), anchorRefs));
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

    private static List<CorridorAnchor> coreAnchorBindings(List<DungeonCorridorAnchorBinding> anchorBindings) {
        List<CorridorAnchor> result = new ArrayList<>();
        for (DungeonCorridorAnchorBinding binding
                : anchorBindings == null ? List.<DungeonCorridorAnchorBinding>of() : anchorBindings) {
            if (binding != null && binding.topologyRef().present()) {
                result.add(binding.toCore());
            }
        }
        return List.copyOf(result);
    }

    private static List<CorridorAnchorRef> coreAnchorRefs(List<DungeonCorridorAnchorRef> anchorRefs) {
        List<CorridorAnchorRef> result = new ArrayList<>();
        for (DungeonCorridorAnchorRef ref : anchorRefs == null ? List.<DungeonCorridorAnchorRef>of() : anchorRefs) {
            if (ref != null && ref.present()) {
                result.add(ref.toCore());
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

    private static List<DungeonCorridorAnchorBinding> worldspaceAnchorBindings(
            List<CorridorAnchor> coreAnchors,
            List<DungeonCorridorAnchorBinding> existingBindings
    ) {
        List<DungeonCorridorAnchorBinding> remaining = nonNullAnchorBindings(existingBindings);
        List<DungeonCorridorAnchorBinding> result = new ArrayList<>();
        for (CorridorAnchor coreAnchor : coreAnchors) {
            DungeonCorridorAnchorBinding binding = matchingExistingAnchorBinding(coreAnchor, remaining);
            if (binding != null) {
                result.add(binding);
            }
        }
        return List.copyOf(result);
    }

    private static List<DungeonCorridorAnchorBinding> nonNullAnchorBindings(
            List<DungeonCorridorAnchorBinding> existingBindings
    ) {
        List<DungeonCorridorAnchorBinding> remaining = new ArrayList<>();
        for (DungeonCorridorAnchorBinding binding
                : existingBindings == null ? List.<DungeonCorridorAnchorBinding>of() : existingBindings) {
            if (binding == null) {
                continue;
            }
            remaining.add(binding);
        }
        return remaining;
    }

    private static DungeonCorridorAnchorBinding matchingExistingAnchorBinding(
            CorridorAnchor coreAnchor,
            List<DungeonCorridorAnchorBinding> remaining
    ) {
        for (int index = 0; index < remaining.size(); index++) {
            DungeonCorridorAnchorBinding candidate = remaining.get(index);
            if (candidate.anchorId() == coreAnchor.anchorId()) {
                return remaining.remove(index);
            }
        }
        return null;
    }

    private static List<DungeonCorridorAnchorRef> worldspaceAnchorRefs(
            List<CorridorAnchorRef> coreRefs,
            List<DungeonCorridorAnchorRef> existingRefs
    ) {
        List<DungeonCorridorAnchorRef> remaining = nonNullAnchorRefs(existingRefs);
        List<DungeonCorridorAnchorRef> result = new ArrayList<>();
        for (CorridorAnchorRef coreRef : coreRefs) {
            result.add(matchingExistingRef(coreRef, remaining));
        }
        return List.copyOf(result);
    }

    private static DungeonCorridorAnchorRef matchingExistingRef(
            CorridorAnchorRef coreRef,
            List<DungeonCorridorAnchorRef> remaining
    ) {
        for (int index = 0; index < remaining.size(); index++) {
            DungeonCorridorAnchorRef candidate = remaining.get(index);
            if (candidate.toCore().equals(coreRef)) {
                return remaining.remove(index);
            }
        }
        return new DungeonCorridorAnchorRef(
                coreRef.hostCorridorId(),
                DungeonTopologyRef.corridorAnchor(coreRef.anchorId()));
    }

    private static List<DungeonCorridorAnchorRef> nonNullAnchorRefs(
            List<DungeonCorridorAnchorRef> existingRefs
    ) {
        List<DungeonCorridorAnchorRef> remaining = new ArrayList<>();
        for (DungeonCorridorAnchorRef ref
                : existingRefs == null ? List.<DungeonCorridorAnchorRef>of() : existingRefs) {
            if (ref == null) {
                continue;
            }
            remaining.add(ref);
        }
        return remaining;
    }
}
