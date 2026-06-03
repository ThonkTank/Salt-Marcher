package src.domain.dungeon.model.worldspace;

import java.util.ArrayList;
import java.util.List;
import src.domain.dungeon.model.core.component.CorridorAnchor;
import src.domain.dungeon.model.core.structure.corridor.CorridorBindings;

final class DungeonCorridorTopologyIdentityBindingsAdapter {

    private DungeonCorridorTopologyIdentityBindingsAdapter() {
    }

    static CorridorBindings toCore(DungeonCorridorBindings source) {
        return new CorridorBindings(
                List.of(),
                List.of(),
                coreAnchorBindings(source.anchorBindings()),
                source.anchorRefs());
    }

    static DungeonCorridorBindings fromCore(DungeonCorridorBindings source, CorridorBindings coreBindings) {
        return new DungeonCorridorBindings(
                source.waypoints(),
                source.doorBindings(),
                worldspaceAnchorBindings(coreBindings.anchorBindings(), source),
                coreBindings.anchorRefs());
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

}
