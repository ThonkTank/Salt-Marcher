package src.domain.dungeon.model.worldspace.model;

import java.util.ArrayList;
import java.util.List;
import src.domain.dungeon.model.core.model.component.CorridorAnchor;
import src.domain.dungeon.model.core.model.component.CorridorAnchorRef;

final class DungeonCorridorAnchorTopologyRefAdapter {

    private DungeonCorridorAnchorTopologyRefAdapter() {
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

    static List<CorridorAnchorRef> coreAnchorRefs(List<DungeonCorridorAnchorRef> anchorRefs) {
        List<CorridorAnchorRef> result = new ArrayList<>();
        for (DungeonCorridorAnchorRef ref : anchorRefs == null ? List.<DungeonCorridorAnchorRef>of() : anchorRefs) {
            if (ref != null && ref.present()) {
                result.add(ref.toCore());
            }
        }
        return List.copyOf(result);
    }

    static List<DungeonCorridorAnchorBinding> worldspaceAnchorBindings(
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

    static List<DungeonCorridorAnchorRef> worldspaceAnchorRefs(
            List<CorridorAnchorRef> coreRefs,
            List<DungeonCorridorAnchorRef> existingRefs,
            List<DungeonCorridorAnchorBinding> routeAnchors
    ) {
        List<DungeonCorridorAnchorRef> remaining = nonNullAnchorRefs(existingRefs);
        List<DungeonCorridorAnchorRef> result = new ArrayList<>();
        for (CorridorAnchorRef coreRef : coreRefs) {
            addIfNewTopologyRef(result, matchingExistingRef(coreRef, remaining, routeAnchors));
        }
        return List.copyOf(result);
    }

    private static void addIfNewTopologyRef(
            List<DungeonCorridorAnchorRef> result,
            DungeonCorridorAnchorRef candidate
    ) {
        for (DungeonCorridorAnchorRef existing : result) {
            if (existing.topologyRef().equals(candidate.topologyRef())) {
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

    private static DungeonCorridorAnchorRef matchingExistingRef(
            CorridorAnchorRef coreRef,
            List<DungeonCorridorAnchorRef> remaining,
            List<DungeonCorridorAnchorBinding> routeAnchors
    ) {
        for (int index = 0; index < remaining.size(); index++) {
            DungeonCorridorAnchorRef candidate = remaining.get(index);
            if (candidate.toCore().equals(coreRef)) {
                return remaining.remove(index);
            }
        }
        DungeonCorridorAnchorBinding routeAnchor = routeAnchorFor(coreRef, routeAnchors);
        if (routeAnchor != null) {
            return new DungeonCorridorAnchorRef(routeAnchor.hostCorridorId(), routeAnchor.topologyRef());
        }
        return new DungeonCorridorAnchorRef(
                coreRef.hostCorridorId(),
                DungeonTopologyRef.corridorAnchor(coreRef.anchorId()));
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

    private static List<DungeonCorridorAnchorRef> nonNullAnchorRefs(
            List<DungeonCorridorAnchorRef> existingRefs
    ) {
        List<DungeonCorridorAnchorRef> remaining = new ArrayList<>();
        for (DungeonCorridorAnchorRef ref
                : existingRefs == null ? List.<DungeonCorridorAnchorRef>of() : existingRefs) {
            if (ref != null) {
                remaining.add(ref);
            }
        }
        return remaining;
    }
}
