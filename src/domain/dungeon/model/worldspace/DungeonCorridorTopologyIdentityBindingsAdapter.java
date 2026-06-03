package src.domain.dungeon.model.worldspace;

import java.util.ArrayList;
import java.util.List;
import src.domain.dungeon.model.core.component.CorridorAnchor;
import src.domain.dungeon.model.core.component.CorridorAnchorRef;
import src.domain.dungeon.model.core.structure.corridor.CorridorBindings;

final class DungeonCorridorTopologyIdentityBindingsAdapter {

    private DungeonCorridorTopologyIdentityBindingsAdapter() {
    }

    static CorridorBindings toCore(DungeonCorridorBindings source) {
        return new CorridorBindings(
                List.of(),
                List.of(),
                coreAnchorBindings(source.anchorBindings()),
                coreAnchorRefs(source.anchorRefs()));
    }

    static DungeonCorridorBindings fromCore(DungeonCorridorBindings source, CorridorBindings coreBindings) {
        return new DungeonCorridorBindings(
                source.waypoints(),
                source.doorBindings(),
                worldspaceAnchorBindings(coreBindings.anchorBindings(), source),
                worldspaceAnchorRefs(coreBindings.anchorRefs(), source));
    }

    private static List<CorridorAnchor> coreAnchorBindings(List<DungeonCorridorAnchorBinding> bindings) {
        List<CorridorAnchor> result = new ArrayList<>();
        for (DungeonCorridorAnchorBinding binding : bindings) {
            if (binding != null && binding.topologyRef().present()) {
                result.add(new CorridorAnchor(
                        binding.topologyRef().id(),
                        binding.hostCorridorId(),
                        binding.absoluteCell().geometry()));
            }
        }
        return List.copyOf(result);
    }

    private static List<CorridorAnchorRef> coreAnchorRefs(List<DungeonCorridorAnchorRef> refs) {
        List<CorridorAnchorRef> result = new ArrayList<>();
        for (DungeonCorridorAnchorRef ref : refs) {
            if (ref != null && ref.present()) {
                result.add(ref.toCore());
            }
        }
        return List.copyOf(result);
    }

    private static List<DungeonCorridorAnchorBinding> worldspaceAnchorBindings(
            List<CorridorAnchor> coreAnchors,
            DungeonCorridorBindings source
    ) {
        List<DungeonCorridorAnchorBinding> result = new ArrayList<>();
        for (CorridorAnchor coreAnchor : coreAnchors) {
            addMatchingAnchorBinding(result, source.anchorBindings(), coreAnchor);
        }
        return List.copyOf(result);
    }

    private static List<DungeonCorridorAnchorRef> worldspaceAnchorRefs(
            List<CorridorAnchorRef> coreRefs,
            DungeonCorridorBindings source
    ) {
        List<DungeonCorridorAnchorRef> result = new ArrayList<>();
        for (CorridorAnchorRef coreRef : coreRefs) {
            addMatchingAnchorRef(result, source.anchorRefs(), coreRef);
        }
        return List.copyOf(result);
    }

    private static void addMatchingAnchorBinding(
            List<DungeonCorridorAnchorBinding> result,
            List<DungeonCorridorAnchorBinding> bindings,
            CorridorAnchor coreAnchor
    ) {
        for (DungeonCorridorAnchorBinding binding : bindings) {
            if (binding != null
                    && binding.hostCorridorId() == coreAnchor.hostCorridorId()
                    && binding.topologyRef().id() == coreAnchor.anchorId()) {
                result.add(binding);
                return;
            }
        }
    }

    private static void addMatchingAnchorRef(
            List<DungeonCorridorAnchorRef> result,
            List<DungeonCorridorAnchorRef> refs,
            CorridorAnchorRef coreRef
    ) {
        for (DungeonCorridorAnchorRef ref : refs) {
            if (ref != null
                    && ref.hostCorridorId() == coreRef.hostCorridorId()
                    && ref.topologyRef().id() == coreRef.anchorId()) {
                result.add(ref);
                return;
            }
        }
    }
}
