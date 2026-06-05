package src.domain.dungeon.model.worldspace;

import java.util.ArrayList;
import java.util.List;
import src.domain.dungeon.model.core.component.CorridorAnchor;
import src.domain.dungeon.model.core.component.CorridorAnchorRef;
import src.domain.dungeon.model.core.component.CorridorDoorBinding;
import src.domain.dungeon.model.core.component.CorridorWaypoint;
import src.domain.dungeon.model.core.structure.corridor.CorridorBindings;
import src.domain.dungeon.model.core.structure.corridor.CorridorRoutePlan;

public record DungeonCorridorBindings(
        List<CorridorWaypoint> waypoints,
        List<DungeonCorridorDoorBinding> doorBindings,
        List<DungeonCorridorAnchorBinding> anchorBindings,
        List<CorridorAnchorRef> anchorRefs
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

    public DungeonCorridorBindings withInteriorRouteAnchors(
            CorridorRoutePlan routePlan,
            List<DungeonCorridorAnchorBinding> routeAnchors
    ) {
        if (routePlan == null) {
            return this;
        }
        CorridorBindings planned = routePlan.bindInteriorAnchors(
                toCore(),
                coreAnchorBindings(routeAnchors));
        return fromCoreRoutePlan(this, planned, routeAnchors);
    }

    public DungeonCorridorBindings replaceAnchorBindings(List<DungeonCorridorAnchorBinding> updatedBindings) {
        CorridorBindings updatedCore = toCore()
                .withAnchorBindings(coreAnchorBindings(updatedBindings));
        return fromCore(
                new DungeonCorridorBindings(waypoints, doorBindings, updatedBindings, anchorRefs),
                updatedCore,
                null);
    }

    CorridorBindings toCore() {
        return new CorridorBindings(
                waypoints,
                coreDoorBindings(doorBindings),
                coreAnchorBindings(anchorBindings),
                anchorRefs);
    }

    CorridorBindings toTopologyIdentityCore() {
        return new CorridorBindings(
                List.of(),
                List.of(),
                topologyIdentityCoreAnchorBindings(anchorBindings),
                anchorRefs);
    }

    static DungeonCorridorBindings fromTopologyIdentityCore(
            DungeonCorridorBindings source,
            CorridorBindings coreBindings
    ) {
        return new DungeonCorridorBindings(
                source.waypoints(),
                source.doorBindings(),
                topologyIdentityAnchorBindingsFromCore(coreBindings.anchorBindings(), source),
                coreBindings.anchorRefs());
    }

    static DungeonCorridorBindings fromCore(
            DungeonCorridorBindings source,
            CorridorBindings coreBindings,
            DungeonCorridorDoorBinding replacementDoor
    ) {
        return fromCore(source, coreBindings, replacementDoor, null);
    }

    static DungeonCorridorBindings fromCore(
            DungeonCorridorBindings source,
            CorridorBindings coreBindings,
            DungeonCorridorDoorBinding replacementDoor,
            DungeonCorridorAnchorBinding replacementAnchor
    ) {
        return new DungeonCorridorBindings(
                coreBindings.waypoints(),
                doorBindingsFromCore(source.doorBindings(), coreBindings.doorBindings(), replacementDoor),
                anchorBindingsFromCore(
                        coreBindings.anchorBindings(),
                        source.anchorBindings(),
                        replacementAnchor),
                coreBindings.anchorRefs());
    }

    static DungeonCorridorBindings fromCoreRoutePlan(
            DungeonCorridorBindings source,
            CorridorBindings planned,
            List<DungeonCorridorAnchorBinding> routeAnchors
    ) {
        return new DungeonCorridorBindings(
                planned.waypoints(),
                source.doorBindings(),
                source.anchorBindings(),
                routeAnchorRefs(
                        planned.anchorRefs(),
                        source.anchorRefs(),
                        routeAnchors));
    }

    static List<CorridorAnchor> coreAnchorBindings(List<DungeonCorridorAnchorBinding> anchorBindings) {
        List<CorridorAnchor> result = new ArrayList<>();
        for (DungeonCorridorAnchorBinding binding
                : anchorBindings == null ? List.<DungeonCorridorAnchorBinding>of() : anchorBindings) {
            if (binding != null && binding.topologyRef().present()) {
                result.add(binding.toCore());
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

    private static List<DungeonCorridorDoorBinding> doorBindingsFromCore(
            List<DungeonCorridorDoorBinding> existingDoors,
            List<CorridorDoorBinding> coreDoors,
            DungeonCorridorDoorBinding replacementBinding
    ) {
        List<DungeonCorridorDoorBinding> remaining = nonNullDoorBindings(existingDoors);
        List<DungeonCorridorDoorBinding> result = new ArrayList<>(coreDoors.size());
        for (CorridorDoorBinding coreDoor : coreDoors) {
            DungeonCorridorDoorBinding binding =
                    replacementOrExistingDoorBinding(coreDoor, replacementBinding, remaining);
            if (binding != null) {
                result.add(binding);
            }
        }
        return List.copyOf(result);
    }

    private static List<DungeonCorridorDoorBinding> nonNullDoorBindings(
            List<DungeonCorridorDoorBinding> doorBindings
    ) {
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

    private static List<CorridorAnchor> topologyIdentityCoreAnchorBindings(
            List<DungeonCorridorAnchorBinding> bindings
    ) {
        List<CorridorAnchor> result = new ArrayList<>();
        for (DungeonCorridorAnchorBinding binding
                : bindings == null ? List.<DungeonCorridorAnchorBinding>of() : bindings) {
            if (binding != null && binding.topologyRef().present()) {
                result.add(new CorridorAnchor(
                        binding.topologyRef().id(),
                        binding.hostCorridorId(),
                        binding.absoluteCell()));
            }
        }
        return List.copyOf(result);
    }

    private static List<DungeonCorridorAnchorBinding> topologyIdentityAnchorBindingsFromCore(
            List<CorridorAnchor> coreAnchors,
            DungeonCorridorBindings source
    ) {
        List<DungeonCorridorAnchorBinding> result = new ArrayList<>();
        for (CorridorAnchor coreAnchor : coreAnchors) {
            addMatchingTopologyIdentityAnchorBinding(result, source.anchorBindings(), coreAnchor);
        }
        return List.copyOf(result);
    }

    private static void addMatchingTopologyIdentityAnchorBinding(
            List<DungeonCorridorAnchorBinding> result,
            List<DungeonCorridorAnchorBinding> bindings,
            CorridorAnchor coreAnchor
    ) {
        for (DungeonCorridorAnchorBinding binding
                : bindings == null ? List.<DungeonCorridorAnchorBinding>of() : bindings) {
            if (binding != null
                    && binding.hostCorridorId() == coreAnchor.hostCorridorId()
                    && binding.topologyRef().id() == coreAnchor.anchorId()) {
                result.add(binding);
                return;
            }
        }
    }

    static List<DungeonCorridorAnchorBinding> anchorBindingsFromCore(
            List<CorridorAnchor> coreAnchors,
            List<DungeonCorridorAnchorBinding> existingBindings,
            DungeonCorridorAnchorBinding replacementBinding
    ) {
        List<DungeonCorridorAnchorBinding> remaining = nonNullAnchorBindings(existingBindings);
        List<DungeonCorridorAnchorBinding> result = new ArrayList<>();
        for (CorridorAnchor coreAnchor : coreAnchors) {
            DungeonCorridorAnchorBinding binding = replacementOrExistingAnchorBinding(
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
            List<DungeonCorridorAnchorBinding> routeAnchors
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

    private static List<DungeonCorridorAnchorBinding> nonNullAnchorBindings(
            List<DungeonCorridorAnchorBinding> existingBindings
    ) {
        List<DungeonCorridorAnchorBinding> remaining = new ArrayList<>();
        for (DungeonCorridorAnchorBinding binding
                : existingBindings == null ? List.<DungeonCorridorAnchorBinding>of() : existingBindings) {
            if (binding != null) {
                remaining.add(binding);
            }
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

    private static DungeonCorridorAnchorBinding replacementOrExistingAnchorBinding(
            CorridorAnchor coreAnchor,
            DungeonCorridorAnchorBinding replacementBinding,
            List<DungeonCorridorAnchorBinding> remaining
    ) {
        if (replacementBinding != null && replacementBinding.anchorId() == coreAnchor.anchorId()) {
            return replacementBinding;
        }
        return matchingExistingAnchorBinding(coreAnchor, remaining);
    }

    private static CorridorAnchorRef matchingExistingRef(
            CorridorAnchorRef coreRef,
            List<CorridorAnchorRef> remaining,
            List<DungeonCorridorAnchorBinding> routeAnchors
    ) {
        for (int index = 0; index < remaining.size(); index++) {
            CorridorAnchorRef candidate = remaining.get(index);
            if (candidate.equals(coreRef)) {
                return remaining.remove(index);
            }
        }
        DungeonCorridorAnchorBinding routeAnchor = routeAnchorFor(coreRef, routeAnchors);
        if (routeAnchor != null) {
            return new CorridorAnchorRef(routeAnchor.hostCorridorId(), routeAnchor.topologyRef().id());
        }
        return coreRef;
    }

    private static DungeonCorridorAnchorBinding routeAnchorFor(
            CorridorAnchorRef coreRef,
            List<DungeonCorridorAnchorBinding> routeAnchors
    ) {
        for (DungeonCorridorAnchorBinding anchor
                : routeAnchors == null ? List.<DungeonCorridorAnchorBinding>of() : routeAnchors) {
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
