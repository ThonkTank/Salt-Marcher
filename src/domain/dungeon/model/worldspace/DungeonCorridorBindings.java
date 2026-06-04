package src.domain.dungeon.model.worldspace;

import java.util.List;
import src.domain.dungeon.model.core.component.CorridorAnchorRef;
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
