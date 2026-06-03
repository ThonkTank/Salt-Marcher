package src.domain.dungeon.model.worldspace;

final class DungeonCorridorDoorTargetDeleteLogic {
    private static final long NO_ID = 0L;
    private static final DungeonCorridorDoorEndpointIndexAdapter ENDPOINT_INDEX_ADAPTER =
            new DungeonCorridorDoorEndpointIndexAdapter();

    DungeonCorridor deleteDoor(
            DungeonMap dungeonMap,
            DungeonCorridor corridor,
            long topologyRefId,
            long roomId
    ) {
        DungeonCorridorDoorBinding removed = removedDoorBinding(corridor, topologyRefId, roomId);
        if (removed == null) {
            return corridor;
        }
        DungeonCorridorDoorEndpointIndexAdapter.EndpointIndexes endpointIndexes =
                ENDPOINT_INDEX_ADAPTER.afterDoorRemoval(dungeonMap, corridor, removed);
        return corridor.withoutDoorTarget(
                removed,
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
