package src.domain.dungeon.model.worldspace;

import java.util.ArrayList;
import java.util.List;
import src.domain.dungeon.model.core.component.CorridorDoorBinding;
import src.domain.dungeon.model.core.structure.corridor.CorridorBindings;

final class DungeonCorridorBindingsCoreAdapter {

    private DungeonCorridorBindingsCoreAdapter() {
    }

    static CorridorBindings toCore(DungeonCorridorBindings source) {
        return new CorridorBindings(
                source.waypoints(),
                coreDoorBindings(source.doorBindings()),
                DungeonCorridorAnchorTopologyRefAdapter.coreAnchorBindings(source.anchorBindings()),
                source.anchorRefs());
    }

    static DungeonCorridorBindings fromCore(
            DungeonCorridorBindings source,
            CorridorBindings coreBindings,
            DungeonCorridorDoorBinding replacementDoor
    ) {
        return new DungeonCorridorBindings(
                coreBindings.waypoints(),
                doorBindingsFromCore(source.doorBindings(), coreBindings.doorBindings(), replacementDoor),
                DungeonCorridorAnchorTopologyRefAdapter.worldspaceAnchorBindings(
                        coreBindings.anchorBindings(),
                        source.anchorBindings()),
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
                DungeonCorridorAnchorTopologyRefAdapter.routeAnchorRefs(
                        planned.anchorRefs(),
                        source.anchorRefs(),
                        routeAnchors));
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
}
