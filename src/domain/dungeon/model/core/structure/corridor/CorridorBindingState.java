package src.domain.dungeon.model.core.structure.corridor;

import java.util.ArrayList;
import java.util.List;
import src.domain.dungeon.model.core.component.CorridorAnchor;
import src.domain.dungeon.model.core.component.CorridorAnchorRef;
import src.domain.dungeon.model.core.component.CorridorDoorBinding;
import src.domain.dungeon.model.core.component.CorridorWaypoint;

public record CorridorBindingState(
        List<CorridorWaypoint> waypoints,
        List<CorridorDoorBindingState> doorBindings,
        List<CorridorAnchorBinding> anchorBindings,
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
            List<CorridorAnchorBinding> routeAnchors
    ) {
        if (routePlan == null) {
            return this;
        }
        CorridorBindings planned = routePlan.bindInteriorAnchors(
                toCore(),
                coreAnchorBindings(routeAnchors));
        return fromCoreRoutePlan(this, planned, routeAnchors);
    }

    public CorridorBindingState replaceAnchorBindings(List<CorridorAnchorBinding> updatedBindings) {
        CorridorBindings updatedCore = toCore()
                .withAnchorBindings(coreAnchorBindings(updatedBindings));
        return fromCore(
                new CorridorBindingState(waypoints, doorBindings, updatedBindings, anchorRefs),
                updatedCore,
                null);
    }

    public CorridorBindings toCore() {
        return new CorridorBindings(
                waypoints,
                coreDoorBindings(doorBindings),
                coreAnchorBindings(anchorBindings),
                anchorRefs);
    }

    public CorridorBindings toTopologyIdentityCore() {
        return new CorridorBindings(
                List.of(),
                List.of(),
                topologyIdentityCoreAnchorBindings(anchorBindings),
                anchorRefs);
    }

    public static CorridorBindingState fromTopologyIdentityCore(
            CorridorBindingState source,
            CorridorBindings coreBindings
    ) {
        return new CorridorBindingState(
                source.waypoints(),
                source.doorBindings(),
                topologyIdentityAnchorBindingsFromCore(coreBindings.anchorBindings(), source),
                coreBindings.anchorRefs());
    }

    public static CorridorBindingState fromCore(
            CorridorBindingState source,
            CorridorBindings coreBindings,
            CorridorDoorBindingState replacementDoor
    ) {
        return fromCore(source, coreBindings, replacementDoor, null);
    }

    public static CorridorBindingState fromCore(
            CorridorBindingState source,
            CorridorBindings coreBindings,
            CorridorDoorBindingState replacementDoor,
            CorridorAnchorBinding replacementAnchor
    ) {
        return new CorridorBindingState(
                coreBindings.waypoints(),
                doorBindingsFromCore(source.doorBindings(), coreBindings.doorBindings(), replacementDoor),
                anchorBindingsFromCore(
                        coreBindings.anchorBindings(),
                        source.anchorBindings(),
                        replacementAnchor),
                coreBindings.anchorRefs());
    }

    static CorridorBindingState fromCoreRoutePlan(
            CorridorBindingState source,
            CorridorBindings planned,
            List<CorridorAnchorBinding> routeAnchors
    ) {
        return new CorridorBindingState(
                planned.waypoints(),
                source.doorBindings(),
                source.anchorBindings(),
                routeAnchorRefs(
                        planned.anchorRefs(),
                        source.anchorRefs(),
                        routeAnchors));
    }

    static List<CorridorAnchor> coreAnchorBindings(List<CorridorAnchorBinding> anchorBindings) {
        List<CorridorAnchor> result = new ArrayList<>();
        for (CorridorAnchorBinding binding
                : anchorBindings == null ? List.<CorridorAnchorBinding>of() : anchorBindings) {
            if (binding != null && binding.topologyRef().present()) {
                result.add(binding.toCore());
            }
        }
        return List.copyOf(result);
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
        return matchingExistingDoorBinding(coreDoor, remaining);
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

    private static List<CorridorAnchor> topologyIdentityCoreAnchorBindings(
            List<CorridorAnchorBinding> bindings
    ) {
        List<CorridorAnchor> result = new ArrayList<>();
        for (CorridorAnchorBinding binding
                : bindings == null ? List.<CorridorAnchorBinding>of() : bindings) {
            if (binding != null && binding.topologyRef().present()) {
                result.add(new CorridorAnchor(
                        binding.topologyRef().id(),
                        binding.hostCorridorId(),
                        binding.absoluteCell()));
            }
        }
        return List.copyOf(result);
    }

    private static List<CorridorAnchorBinding> topologyIdentityAnchorBindingsFromCore(
            List<CorridorAnchor> coreAnchors,
            CorridorBindingState source
    ) {
        List<CorridorAnchorBinding> result = new ArrayList<>();
        for (CorridorAnchor coreAnchor : coreAnchors) {
            addMatchingTopologyIdentityAnchorBinding(result, source.anchorBindings(), coreAnchor);
        }
        return List.copyOf(result);
    }

    private static void addMatchingTopologyIdentityAnchorBinding(
            List<CorridorAnchorBinding> result,
            List<CorridorAnchorBinding> bindings,
            CorridorAnchor coreAnchor
    ) {
        for (CorridorAnchorBinding binding
                : bindings == null ? List.<CorridorAnchorBinding>of() : bindings) {
            if (binding != null
                    && binding.hostCorridorId() == coreAnchor.hostCorridorId()
                    && binding.topologyRef().id() == coreAnchor.anchorId()) {
                result.add(binding);
                return;
            }
        }
    }

    static List<CorridorAnchorBinding> anchorBindingsFromCore(
            List<CorridorAnchor> coreAnchors,
            List<CorridorAnchorBinding> existingBindings,
            CorridorAnchorBinding replacementBinding
    ) {
        List<CorridorAnchorBinding> remaining = nonNullAnchorBindings(existingBindings);
        List<CorridorAnchorBinding> result = new ArrayList<>();
        for (CorridorAnchor coreAnchor : coreAnchors) {
            CorridorAnchorBinding binding = replacementOrExistingAnchorBinding(
                    coreAnchor,
                    replacementBinding,
                    remaining);
            if (binding != null) {
                result.add(binding);
            }
        }
        return List.copyOf(result);
    }

    static List<CorridorAnchorRef> routeAnchorRefs(
            List<CorridorAnchorRef> coreRefs,
            List<CorridorAnchorRef> existingRefs,
            List<CorridorAnchorBinding> routeAnchors
    ) {
        List<CorridorAnchorRef> remaining = nonNullAnchorRefs(existingRefs);
        List<CorridorAnchorRef> result = new ArrayList<>();
        for (CorridorAnchorRef coreRef : coreRefs) {
            addIfNewAnchorId(result, matchingExistingRef(coreRef, remaining, routeAnchors));
        }
        return List.copyOf(result);
    }

    private static void addIfNewAnchorId(
            List<CorridorAnchorRef> result,
            CorridorAnchorRef candidate
    ) {
        for (CorridorAnchorRef existing : result) {
            if (existing.anchorId() == candidate.anchorId()) {
                return;
            }
        }
        result.add(candidate);
    }

    private static List<CorridorAnchorBinding> nonNullAnchorBindings(
            List<CorridorAnchorBinding> existingBindings
    ) {
        List<CorridorAnchorBinding> remaining = new ArrayList<>();
        for (CorridorAnchorBinding binding
                : existingBindings == null ? List.<CorridorAnchorBinding>of() : existingBindings) {
            if (binding != null) {
                remaining.add(binding);
            }
        }
        return remaining;
    }

    private static CorridorAnchorBinding matchingExistingAnchorBinding(
            CorridorAnchor coreAnchor,
            List<CorridorAnchorBinding> remaining
    ) {
        for (int index = 0; index < remaining.size(); index++) {
            CorridorAnchorBinding candidate = remaining.get(index);
            if (candidate.anchorId() == coreAnchor.anchorId()) {
                return remaining.remove(index);
            }
        }
        return null;
    }

    private static CorridorAnchorBinding replacementOrExistingAnchorBinding(
            CorridorAnchor coreAnchor,
            CorridorAnchorBinding replacementBinding,
            List<CorridorAnchorBinding> remaining
    ) {
        if (replacementBinding != null && replacementBinding.anchorId() == coreAnchor.anchorId()) {
            return replacementBinding;
        }
        return matchingExistingAnchorBinding(coreAnchor, remaining);
    }

    private static CorridorAnchorRef matchingExistingRef(
            CorridorAnchorRef coreRef,
            List<CorridorAnchorRef> remaining,
            List<CorridorAnchorBinding> routeAnchors
    ) {
        for (int index = 0; index < remaining.size(); index++) {
            CorridorAnchorRef candidate = remaining.get(index);
            if (candidate.equals(coreRef)) {
                return remaining.remove(index);
            }
        }
        CorridorAnchorBinding routeAnchor = routeAnchorFor(coreRef, routeAnchors);
        if (routeAnchor != null) {
            return new CorridorAnchorRef(routeAnchor.hostCorridorId(), routeAnchor.topologyRef().id());
        }
        return coreRef;
    }

    private static CorridorAnchorBinding routeAnchorFor(
            CorridorAnchorRef coreRef,
            List<CorridorAnchorBinding> routeAnchors
    ) {
        for (CorridorAnchorBinding anchor
                : routeAnchors == null ? List.<CorridorAnchorBinding>of() : routeAnchors) {
            if (anchor != null
                    && anchor.hostCorridorId() == coreRef.hostCorridorId()
                    && anchor.anchorId() == coreRef.anchorId()) {
                return anchor;
            }
        }
        return null;
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
}
