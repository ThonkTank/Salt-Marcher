package src.domain.dungeon.model.worldspace;

import java.util.ArrayList;
import java.util.List;
import src.domain.dungeon.model.core.component.CorridorAnchor;
import src.domain.dungeon.model.core.component.CorridorAnchorRef;

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
