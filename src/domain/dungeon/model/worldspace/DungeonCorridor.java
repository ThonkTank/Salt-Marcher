package src.domain.dungeon.model.worldspace;


import java.util.List;
import src.domain.dungeon.model.core.component.CorridorAnchorRef;
import src.domain.dungeon.model.core.structure.corridor.Corridor;
import src.domain.dungeon.model.core.structure.corridor.CorridorBindings;

public record DungeonCorridor(
        long corridorId,
        long mapId,
        int level,
        List<Long> roomIds,
        DungeonCorridorBindings bindings
) {
    public DungeonCorridor {
        Corridor coreCorridor = new Corridor(corridorId, mapId, level, roomIds, coreBindings(bindings));
        corridorId = coreCorridor.corridorId();
        mapId = coreCorridor.mapId();
        roomIds = coreCorridor.roomIds();
        bindings = bindings == null ? DungeonCorridorBindings.empty() : bindings;
    }

    @Override
    public List<Long> roomIds() {
        return List.copyOf(roomIds);
    }

    public boolean isReadable() {
        return DungeonCorridorCoreAdapter.toCore(this).isReadable();
    }

    public DungeonCorridor withDoorBinding(DungeonCorridorDoorBinding binding) {
        if (binding == null) {
            return this;
        }
        Corridor updated = DungeonCorridorCoreAdapter.toCore(this).withDoorBinding(binding.toCore());
        return DungeonCorridorCoreAdapter.fromCore(this, updated, binding);
    }

    public DungeonCorridor withAnchorBinding(DungeonCorridorAnchorBinding binding) {
        if (binding == null) {
            return this;
        }
        return withBindings(bindings.withAnchorBinding(binding));
    }

    public DungeonCorridor withAnchorRef(CorridorAnchorRef ref) {
        if (ref == null || !ref.present()) {
            return this;
        }
        return withBindings(bindings.withAnchorRef(ref));
    }

    public DungeonCorridor withoutDoorTarget(
            DungeonCorridorDoorBinding removedDoor,
            boolean pruneRouteWaypoints,
            int firstEndpointIndex,
            int secondEndpointIndex
    ) {
        if (removedDoor == null) {
            return this;
        }
        Corridor updated = DungeonCorridorCoreAdapter.toCore(this).withoutDoorTarget(
                removedDoor.toCore(),
                pruneRouteWaypoints,
                firstEndpointIndex,
                secondEndpointIndex);
        return DungeonCorridorCoreAdapter.fromCore(this, updated, null);
    }

    public DungeonCorridor withoutAnchorTarget(long topologyRefId) {
        Corridor current = DungeonCorridorCoreAdapter.toCore(this);
        Corridor updated = current.withoutAnchorTarget(topologyRefId);
        return updated.equals(current)
                ? this
                : DungeonCorridorCoreAdapter.fromCore(this, updated, null);
    }

    public DungeonCorridor withoutWaypointTarget(int waypointIndex) {
        Corridor current = DungeonCorridorCoreAdapter.toCore(this);
        Corridor updated = current.withoutWaypointTarget(waypointIndex);
        return updated.equals(current)
                ? this
                : DungeonCorridorCoreAdapter.fromCore(this, updated, null);
    }

    public DungeonCorridor withBindings(DungeonCorridorBindings nextBindings) {
        return new DungeonCorridor(corridorId, mapId, level, roomIds, nextBindings);
    }

    public int endpointCount() {
        return DungeonCorridorCoreAdapter.toCore(this).endpointCount();
    }

    private static CorridorBindings coreBindings(DungeonCorridorBindings bindings) {
        return DungeonCorridorBindingsCoreAdapter.toCore(bindings == null ? DungeonCorridorBindings.empty() : bindings);
    }
}
