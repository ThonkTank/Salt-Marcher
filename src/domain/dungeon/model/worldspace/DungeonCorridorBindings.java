package src.domain.dungeon.model.worldspace;

import java.util.List;
import src.domain.dungeon.model.core.structure.corridor.CorridorBindings;
import src.domain.dungeon.model.core.structure.corridor.CorridorRoutePlan;

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
        return new DungeonCorridorBindings(List.of(), List.of(), List.of(), List.of());
    }

    public DungeonCorridorBindings withAnchorBinding(DungeonCorridorAnchorBinding binding) {
        if (binding == null || !binding.topologyRef().present()) {
            return this;
        }
        List<DungeonCorridorAnchorBinding> updated = new java.util.ArrayList<>();
        for (DungeonCorridorAnchorBinding existing : anchorBindings) {
            if (existing != null && !existing.topologyRef().equals(binding.topologyRef())) {
                updated.add(existing);
            }
        }
        CorridorBindings currentCore = DungeonCorridorBindingsCoreAdapter.toCore(this);
        CorridorBindings updatedCore = new CorridorBindings(
                DungeonCorridorBindingsCoreAdapter.coreWaypoints(waypoints),
                currentCore.doorBindings(),
                DungeonCorridorAnchorTopologyRefAdapter.coreAnchorBindings(updated),
                currentCore.anchorRefs())
                .withAnchorBinding(binding.toCore());
        updated.add(binding);
        return new DungeonCorridorBindings(
                waypoints,
                doorBindings,
                DungeonCorridorAnchorTopologyRefAdapter.worldspaceAnchorBindings(
                        updatedCore.anchorBindings(),
                        updated),
                anchorRefs);
    }

    public DungeonCorridorBindings withAnchorRef(DungeonCorridorAnchorRef ref) {
        if (ref == null || !ref.present()) {
            return this;
        }
        List<DungeonCorridorAnchorRef> updated = new java.util.ArrayList<>();
        for (DungeonCorridorAnchorRef existing : anchorRefs) {
            if (existing != null && !existing.topologyRef().equals(ref.topologyRef())) {
                updated.add(existing);
            }
        }
        CorridorBindings currentCore = DungeonCorridorBindingsCoreAdapter.toCore(this);
        CorridorBindings updatedCore = new CorridorBindings(
                DungeonCorridorBindingsCoreAdapter.coreWaypoints(waypoints),
                currentCore.doorBindings(),
                currentCore.anchorBindings(),
                DungeonCorridorAnchorTopologyRefAdapter.coreAnchorRefs(updated))
                .withAnchorRef(ref.toCore());
        updated.add(ref);
        return new DungeonCorridorBindings(
                waypoints,
                doorBindings,
                anchorBindings,
                DungeonCorridorAnchorTopologyRefAdapter.worldspaceAnchorRefs(
                        updatedCore.anchorRefs(),
                        updated,
                        List.of()));
    }


    public DungeonCorridorBindings withInteriorRouteAnchors(
            CorridorRoutePlan routePlan,
            List<DungeonCorridorAnchorBinding> routeAnchors
    ) {
        if (routePlan == null) {
            return this;
        }
        CorridorBindings planned = routePlan.bindInteriorAnchors(
                DungeonCorridorBindingsCoreAdapter.toCore(this),
                DungeonCorridorAnchorTopologyRefAdapter.coreAnchorBindings(routeAnchors));
        return DungeonCorridorBindingsCoreAdapter.fromCoreRoutePlan(this, planned, routeAnchors);
    }

    public DungeonCorridorBindings replaceAnchorBindings(List<DungeonCorridorAnchorBinding> updatedBindings) {
        CorridorBindings updatedCore = DungeonCorridorBindingsCoreAdapter.toCore(this)
                .withAnchorBindings(DungeonCorridorAnchorTopologyRefAdapter.coreAnchorBindings(updatedBindings));
        return DungeonCorridorBindingsCoreAdapter.fromCore(
                new DungeonCorridorBindings(waypoints, doorBindings, updatedBindings, anchorRefs),
                updatedCore,
                null);
    }

}
