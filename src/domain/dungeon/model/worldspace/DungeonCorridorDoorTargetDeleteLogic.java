package src.domain.dungeon.model.worldspace;

import src.domain.dungeon.model.core.structure.corridor.Corridor;

final class DungeonCorridorDoorTargetDeleteLogic {
    private static final long NO_ID = 0L;
    private static final DungeonCorridorDoorEndpointIndexAdapter ENDPOINT_INDEX_ADAPTER =
            new DungeonCorridorDoorEndpointIndexAdapter();

    Corridor deleteDoor(
            DungeonMap dungeonMap,
            DungeonCorridor corridor,
            Corridor current,
            long topologyRefId,
            long roomId
    ) {
        DungeonCorridorDoorBinding removed = removedDoorBinding(corridor, topologyRefId, roomId);
        if (removed == null) {
            return current;
        }
        DungeonCorridorDoorEndpointIndexAdapter.EndpointIndexes endpointIndexes =
                ENDPOINT_INDEX_ADAPTER.afterDoorRemoval(dungeonMap, corridor, removed);
        return current.withoutDoorTarget(
                removed.toCore(),
                endpointIndexes.pruneWaypoints(),
                endpointIndexes.firstEndpointIndex(),
                endpointIndexes.secondEndpointIndex());
    }

    private DungeonCorridorDoorBinding removedDoorBinding(DungeonCorridor corridor, long topologyRefId, long roomId) {
        for (DungeonCorridorDoorBinding binding : corridor.bindings().doorBindings()) {
            if (binding != null && matchesDoorBinding(binding, topologyRefId, roomId)) {
                return binding;
            }
        }
        return null;
    }

    private boolean matchesDoorBinding(DungeonCorridorDoorBinding binding, long topologyRefId, long roomId) {
        return (topologyRefId > NO_ID && binding.topologyRef().id() == topologyRefId)
                || (roomId > NO_ID && binding.roomId() == roomId);
    }

}
