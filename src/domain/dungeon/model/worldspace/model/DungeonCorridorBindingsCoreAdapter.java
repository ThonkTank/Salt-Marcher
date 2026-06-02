package src.domain.dungeon.model.worldspace.model;

import java.util.ArrayList;
import java.util.List;
import src.domain.dungeon.model.core.model.component.CorridorDoorBinding;
import src.domain.dungeon.model.core.model.component.CorridorWaypoint;
import src.domain.dungeon.model.core.model.structure.CorridorBindings;

final class DungeonCorridorBindingsCoreAdapter {

    private DungeonCorridorBindingsCoreAdapter() {
    }

    static CorridorBindings toCore(DungeonCorridorBindings source) {
        return new CorridorBindings(
                coreWaypoints(source.waypoints()),
                coreDoorBindings(source.doorBindings()),
                DungeonCorridorAnchorTopologyRefAdapter.coreAnchorBindings(source.anchorBindings()),
                DungeonCorridorAnchorTopologyRefAdapter.coreAnchorRefs(source.anchorRefs()));
    }

    static DungeonCorridorBindings fromCore(
            DungeonCorridorBindings source,
            CorridorBindings coreBindings,
            DungeonCorridorDoorBinding replacementDoor
    ) {
        return new DungeonCorridorBindings(
                worldspaceWaypoints(coreBindings.waypoints()),
                doorBindingsFromCore(source.doorBindings(), coreBindings.doorBindings(), replacementDoor),
                DungeonCorridorAnchorTopologyRefAdapter.worldspaceAnchorBindings(
                        coreBindings.anchorBindings(),
                        source.anchorBindings()),
                DungeonCorridorAnchorTopologyRefAdapter.worldspaceAnchorRefs(
                        coreBindings.anchorRefs(),
                        source.anchorRefs(),
                        List.of()));
    }

    static DungeonCorridorBindings fromCoreRoutePlan(
            DungeonCorridorBindings source,
            CorridorBindings planned,
            List<DungeonCorridorAnchorBinding> routeAnchors
    ) {
        return new DungeonCorridorBindings(
                worldspaceWaypoints(planned.waypoints()),
                source.doorBindings(),
                source.anchorBindings(),
                DungeonCorridorAnchorTopologyRefAdapter.worldspaceAnchorRefs(
                        planned.anchorRefs(),
                        source.anchorRefs(),
                        routeAnchors));
    }

    static List<CorridorWaypoint> coreWaypoints(List<DungeonCorridorWaypoint> waypoints) {
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

    static List<DungeonCorridorWaypoint> worldspaceWaypoints(List<CorridorWaypoint> waypoints) {
        List<DungeonCorridorWaypoint> result = new ArrayList<>();
        for (CorridorWaypoint waypoint : waypoints) {
            result.add(DungeonCorridorWaypoint.fromCore(waypoint));
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
