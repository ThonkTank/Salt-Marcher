package features.dungeon.domain.core.structure.corridor;

import java.util.ArrayList;
import java.util.List;
import features.dungeon.domain.core.component.CorridorAnchor;
import features.dungeon.domain.core.component.CorridorAnchorRef;
import features.dungeon.domain.core.component.CorridorDoorBinding;
import features.dungeon.domain.core.component.CorridorWaypoint;
import features.dungeon.domain.core.graph.DungeonTopologyRef;

public record CorridorBindingState(
        List<CorridorWaypoint> waypoints,
        List<CorridorDoorBindingState> doorBindings,
        List<CorridorAnchor> anchorBindings,
        List<CorridorAnchorRef> anchorRefs
) {

    public CorridorBindingState {
        waypoints = waypoints == null ? List.of() : List.copyOf(waypoints);
        doorBindings = doorBindings == null ? List.of() : List.copyOf(doorBindings);
        anchorBindings = anchorBindings == null ? List.of() : List.copyOf(anchorBindings);
        anchorRefs = anchorRefs == null ? List.of() : List.copyOf(anchorRefs);
    }

    public static CorridorBindingState empty() {
        return new CorridorBindingState(List.of(), List.of(), List.of(), List.of());
    }

    public CorridorBindingState withInteriorRouteAnchors(
            CorridorRoutePlan routePlan,
            List<CorridorAnchor> routeAnchors
    ) {
        if (routePlan == null) {
            return this;
        }
        CorridorBindings planned = routePlan.bindInteriorAnchors(
                toCore(),
                nonNullAnchorBindings(routeAnchors));
        return fromCoreRoutePlan(this, planned);
    }

    public CorridorBindingState replaceAnchorBindings(List<CorridorAnchor> updatedBindings) {
        return new CorridorBindingState(waypoints, doorBindings, updatedBindings, anchorRefs);
    }

    public CorridorBindingState replaceWaypoints(List<CorridorWaypoint> updatedWaypoints) {
        return new CorridorBindingState(updatedWaypoints, doorBindings, anchorBindings, anchorRefs);
    }

    public CorridorBindings toCore() {
        return new CorridorBindings(
                waypoints,
                coreDoorBindings(doorBindings),
                anchorBindings,
                anchorRefs);
    }

    public static CorridorBindingState fromCore(
            CorridorBindingState source,
            CorridorBindings coreBindings,
            CorridorDoorBindingState replacementDoor
    ) {
        return new CorridorBindingState(
                coreBindings.waypoints(),
                doorBindingsFromCore(source.doorBindings(), coreBindings.doorBindings(), replacementDoor),
                coreBindings.anchorBindings(),
                coreBindings.anchorRefs());
    }

    static CorridorBindingState fromCoreRoutePlan(
            CorridorBindingState source,
            CorridorBindings planned
    ) {
        return new CorridorBindingState(
                planned.waypoints(),
                source.doorBindings(),
                source.anchorBindings(),
                routeAnchorRefs(planned.anchorRefs(), source.anchorRefs()));
    }

    private static List<CorridorDoorBinding> coreDoorBindings(List<CorridorDoorBindingState> doorBindings) {
        List<CorridorDoorBinding> result = new ArrayList<>();
        for (CorridorDoorBindingState binding : doorBindings) {
            if (binding != null) {
                result.add(binding.toCore());
            }
        }
        return List.copyOf(result);
    }

    private static List<CorridorDoorBindingState> doorBindingsFromCore(
            List<CorridorDoorBindingState> existingDoors,
            List<CorridorDoorBinding> coreDoors,
            CorridorDoorBindingState replacementBinding
    ) {
        List<CorridorDoorBindingState> remaining = nonNullDoorBindings(existingDoors);
        List<CorridorDoorBindingState> result = new ArrayList<>(coreDoors.size());
        for (CorridorDoorBinding coreDoor : coreDoors) {
            CorridorDoorBindingState binding =
                    replacementOrExistingDoorBinding(coreDoor, replacementBinding, remaining);
            if (binding != null) {
                result.add(binding);
            }
        }
        return List.copyOf(result);
    }

    private static List<CorridorDoorBindingState> nonNullDoorBindings(
            List<CorridorDoorBindingState> doorBindings
    ) {
        List<CorridorDoorBindingState> result = new ArrayList<>();
        for (CorridorDoorBindingState binding : doorBindings) {
            if (binding != null) {
                result.add(binding);
            }
        }
        return result;
    }

    private static CorridorDoorBindingState replacementOrExistingDoorBinding(
            CorridorDoorBinding coreDoor,
            CorridorDoorBindingState replacementBinding,
            List<CorridorDoorBindingState> remaining
    ) {
        if (replacementBinding != null && coreDoor.roomId() == replacementBinding.roomId()) {
            return replacementBinding;
        }
        CorridorDoorBindingState existing = matchingExistingDoorBinding(coreDoor, remaining);
        return existing == null
                ? new CorridorDoorBindingState(
                        coreDoor.roomId(),
                        coreDoor.clusterId(),
                        coreDoor.relativeCell(),
                        coreDoor.direction(),
                        DungeonTopologyRef.empty())
                : existing;
    }

    private static CorridorDoorBindingState matchingExistingDoorBinding(
            CorridorDoorBinding coreDoor,
            List<CorridorDoorBindingState> remaining
    ) {
        for (int index = 0; index < remaining.size(); index++) {
            CorridorDoorBindingState candidate = remaining.get(index);
            if (candidate.toCore().equals(coreDoor)) {
                return remaining.remove(index);
            }
        }
        return null;
    }

    static List<CorridorAnchorRef> routeAnchorRefs(
            List<CorridorAnchorRef> coreRefs,
            List<CorridorAnchorRef> existingRefs
    ) {
        List<CorridorAnchorRef> remaining = nonNullAnchorRefs(existingRefs);
        List<CorridorAnchorRef> result = new ArrayList<>();
        for (CorridorAnchorRef coreRef : coreRefs) {
            addIfNewAnchorId(result, matchingExistingRef(coreRef, remaining));
        }
        return List.copyOf(result);
    }

    private static void addIfNewAnchorId(
            List<CorridorAnchorRef> result,
            CorridorAnchorRef candidate
    ) {
        for (CorridorAnchorRef existing : result) {
            if (existing.hostCorridorId() == candidate.hostCorridorId()
                    && existing.anchorId() == candidate.anchorId()) {
                return;
            }
        }
        result.add(candidate);
    }

    private static CorridorAnchorRef matchingExistingRef(
            CorridorAnchorRef coreRef,
            List<CorridorAnchorRef> remaining
    ) {
        for (int index = 0; index < remaining.size(); index++) {
            CorridorAnchorRef candidate = remaining.get(index);
            if (candidate.equals(coreRef)) {
                return remaining.remove(index);
            }
        }
        return coreRef;
    }

    private static List<CorridorAnchorRef> nonNullAnchorRefs(
            List<CorridorAnchorRef> existingRefs
    ) {
        List<CorridorAnchorRef> remaining = new ArrayList<>();
        for (CorridorAnchorRef ref : existingRefs == null ? List.<CorridorAnchorRef>of() : existingRefs) {
            if (ref != null) {
                remaining.add(ref);
            }
        }
        return remaining;
    }

    private static List<CorridorAnchor> nonNullAnchorBindings(
            List<CorridorAnchor> source
    ) {
        List<CorridorAnchor> result = new ArrayList<>();
        for (CorridorAnchor anchor : source == null ? List.<CorridorAnchor>of() : source) {
            if (anchor != null) {
                result.add(anchor);
            }
        }
        return List.copyOf(result);
    }
}
